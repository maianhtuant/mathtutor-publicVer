# Build the WAR with the Gradle wrapper on JDK 25, then deploy it to WildFly (JBoss) 41 on JDK 25.
FROM eclipse-temurin:25-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN ./gradlew --no-daemon dependencies > /dev/null
COPY src ./src
RUN ./gradlew --no-daemon bootWar -x test

FROM quay.io/wildfly/wildfly:42.0.0.Final-jdk25
COPY --from=build --chown=jboss:jboss /src/build/libs/ROOT.war /opt/jboss/wildfly/standalone/deployments/ROOT.war
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=40s --retries=10 CMD curl -fs http://localhost:8080/api/health || exit 1
CMD ["/opt/jboss/wildfly/bin/standalone.sh", "-b", "0.0.0.0"]
