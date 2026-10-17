package com.mathtutor.videos;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class VideoUrlParserTest {

    private static VideoUrlParser.Parsed yt(String id) {
        return new VideoUrlParser.Parsed("youtube", id);
    }

    @Test
    void parsesSupportedLinks() {
        assertEquals(yt("znmPfDfsir8"), VideoUrlParser.parse("https://www.youtube.com/watch?v=znmPfDfsir8"));
        assertEquals(yt("znmPfDfsir8"), VideoUrlParser.parse("https://www.youtube.com/watch?list=x&v=znmPfDfsir8&t=3"));
        assertEquals(yt("znmPfDfsir8"), VideoUrlParser.parse("https://youtu.be/znmPfDfsir8"));
        assertEquals(yt("znmPfDfsir8"), VideoUrlParser.parse("https://www.youtube.com/embed/znmPfDfsir8"));
        assertEquals(new VideoUrlParser.Parsed("vimeo", "76979871"), VideoUrlParser.parse("https://vimeo.com/76979871"));
        assertEquals(new VideoUrlParser.Parsed("vimeo", "76979871"), VideoUrlParser.parse("https://vimeo.com/video/76979871"));
        assertEquals(new VideoUrlParser.Parsed("unknown", null), VideoUrlParser.parse("https://example.com/v.mp4"));
    }

    @Test
    void buildsEmbedUrls() {
        assertEquals("https://www.youtube-nocookie.com/embed/abc123", VideoUrlParser.embedUrl("youtube", "abc123"));
        assertEquals("https://player.vimeo.com/video/42", VideoUrlParser.embedUrl("vimeo", "42"));
    }
}
