"""Math service: template validation, question generation and exact answers (SymPy).

Called only by the Spring Boot backend; it never touches the database.
"""
from __future__ import annotations

import os
from decimal import Decimal
from typing import Any, Literal

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from .engine.generator import ENGINE_VERSION, GenerationError, TemplateConfig, generate, validate

API_KEY = os.getenv("MATH_SERVICE_API_KEY", "")

app = FastAPI(title="MathTutor Math Service", version=ENGINE_VERSION)


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class TemplateIn(CamelModel):
    prompt_template: str = Field(max_length=4000)
    answer_formula: str | None = Field(default=None, max_length=500)
    answer_mode: Literal["numeric", "multiple_choice", "display_only"]
    default_min: Decimal = Decimal(1)
    default_max: Decimal = Decimal(10)
    variables: dict[str, Any] = Field(default_factory=dict)
    constraints: list[str] = Field(default_factory=list, max_length=20)
    relative_tolerance_percent: Decimal = Decimal(0)
    absolute_tolerance: Decimal = Decimal(0)
    decimal_places: int = Field(default=2, ge=0, le=12)
    accept_rounded_decimal: bool = False
    wrong_answer_formulas: list[str] = Field(default_factory=list, max_length=6)
    figure: dict[str, Any] | None = None

    def to_config(self) -> TemplateConfig:
        return TemplateConfig(**self.model_dump(by_alias=False))


class GenerateIn(CamelModel):
    template: TemplateIn
    count: int = Field(ge=1, le=100)
    seed: str = Field(min_length=1, max_length=200)
    salt: str = Field(default="", max_length=200)
    overrides: dict[str, Any] = Field(default_factory=dict)


class GenerateBatchIn(CamelModel):
    """Generate several groups (one per practice-set rule) in a single call."""
    groups: list[GenerateIn] = Field(min_length=1, max_length=50)


class ValidateIn(CamelModel):
    template: TemplateIn
    sample_count: int = Field(default=5, ge=1, le=20)


def _check_key(key: str | None):
    if API_KEY and key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid API key")


@app.exception_handler(GenerationError)
async def generation_error(_: Request, exc: GenerationError):
    return JSONResponse(status_code=422, content={"error": exc.code, "message": exc.message})


@app.get("/health")
def health():
    return {"status": "ok", "engineVersion": ENGINE_VERSION}


@app.post("/v1/templates/validate")
def validate_template(body: ValidateIn, x_api_key: str | None = Header(default=None)):
    _check_key(x_api_key)
    return validate(body.template.to_config(), body.sample_count)


@app.post("/v1/generate")
def generate_questions(body: GenerateIn, x_api_key: str | None = Header(default=None)):
    _check_key(x_api_key)
    return generate(body.template.to_config(), count=body.count, seed=body.seed, salt=body.salt,
                    overrides=body.overrides)


@app.post("/v1/generate/batch")
def generate_batch(body: GenerateBatchIn, x_api_key: str | None = Header(default=None)):
    _check_key(x_api_key)
    if sum(g.count for g in body.groups) > 500:
        raise GenerationError("invalid_count", "a batch may contain at most 500 questions")
    groups = []
    for index, g in enumerate(body.groups):
        try:
            groups.append(generate(g.template.to_config(), count=g.count, seed=g.seed, salt=g.salt,
                                   overrides=g.overrides))
        except GenerationError as exc:
            raise GenerationError(exc.code, f"group {index + 1}: {exc.message}") from exc
    return {"engineVersion": ENGINE_VERSION, "groups": groups}
