package com.mathtutor.videos;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Extracts the provider and embed id from YouTube / Vimeo links (no file uploads). */
public final class VideoUrlParser {
    private VideoUrlParser() {}

    private static final Pattern YT_WATCH = Pattern.compile("youtube\\.com/watch\\?(?:.*&)?v=([A-Za-z0-9_-]{6,})");
    private static final Pattern YT_SHORT = Pattern.compile("youtu\\.be/([A-Za-z0-9_-]{6,})");
    private static final Pattern YT_EMBED = Pattern.compile("youtube(?:-nocookie)?\\.com/(?:embed|shorts|live)/([A-Za-z0-9_-]{6,})");
    private static final Pattern VIMEO = Pattern.compile("vimeo\\.com/(?:video/)?(\\d+)");

    public record Parsed(String provider, String embedId) {}

    public static Parsed parse(String url) {
        if (url == null) {
            return new Parsed("unknown", null);
        }
        String u = url.strip();
        for (Pattern p : new Pattern[] {YT_WATCH, YT_SHORT, YT_EMBED}) {
            Matcher m = p.matcher(u);
            if (m.find()) {
                return new Parsed("youtube", m.group(1));
            }
        }
        Matcher m = VIMEO.matcher(u);
        if (m.find()) {
            return new Parsed("vimeo", m.group(1));
        }
        return new Parsed("unknown", null);
    }

    public static String embedUrl(String provider, String embedId) {
        if (embedId == null) {
            return null;
        }
        return switch (provider) {
            case "youtube" -> "https://www.youtube-nocookie.com/embed/" + embedId;
            case "vimeo" -> "https://player.vimeo.com/video/" + embedId;
            default -> null;
        };
    }

    public static String thumbnailUrl(String provider, String embedId) {
        return "youtube".equals(provider) && embedId != null ? "https://img.youtube.com/vi/" + embedId + "/hqdefault.jpg" : null;
    }
}
