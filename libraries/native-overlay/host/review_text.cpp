#include "review_text.hpp"
#include <algorithm>

bool is_review_text(const tela::SceneOverlayElement& element) {
    return element.id.rfind("pf-review-heading/", 0) == 0 || element.id.rfind("pf-review-body/", 0) == 0;
}
std::vector<ReviewSection> review_sections(const tela::SceneOverlay& overlay, const std::string& mode) {
    std::vector<ReviewSection> sections;
    const auto heading = "pf-review-heading/" + mode + "/", body = "pf-review-body/" + mode + "/";
    for (const auto& element : overlay.elements()) {
        const auto scene = std::find_if(overlay.scenes().begin(), overlay.scenes().end(), [&](const auto& item) { return item.id == element.scene_id; });
        if (scene == overlay.scenes().end() || !scene->visible) continue;
        if (element.id.rfind(heading, 0) == 0) sections.push_back({element.id.substr(heading.size()), element.label, {}, false});
        if (element.id.rfind(body, 0) == 0) {
            const auto key = element.id.substr(body.size(), element.id.rfind('/') - body.size());
            const auto section = std::find_if(sections.begin(), sections.end(), [&](const auto& item) { return item.id == key; });
            if (section != sections.end()) section->body.push_back(element.label);
        }
    }
    for (auto& section : sections) {
        std::size_t points = 0;
        for (const auto& line : section.body) for (const unsigned char byte : line) if ((byte & 0xc0) != 0x80) ++points;
        section.long_body = points > 280 || section.body.size() > 5;
    }
    return sections;
}
std::vector<std::string> review_text_lines(const std::vector<std::string>& body, float width) {
    std::vector<std::string> lines;
    const auto columns = static_cast<std::size_t>(std::max(1.0f, (width - 20) / 18));
    for (const auto& text : body) {
        std::string line; std::size_t count = 0;
        for (const unsigned char byte : text) {
            if ((byte & 0xc0) != 0x80) {
                if (count == columns) { lines.push_back(line); line.clear(); count = 0; }
                ++count;
            }
            line += static_cast<char>(byte);
        }
        lines.push_back(line);
    }
    return lines;
}
