#include "review_panel.hpp"
#include "review_text.hpp"
#include <algorithm>
#include <cmath>

void review_panel(tela::Document& result, const tela::SceneOverlay& overlay, const tela::Viewport& view,
    ReviewNavigation navigation, std::function<void(ReviewNavigation)> navigate) {
    const auto sections = review_sections(overlay, navigation.mode == ReviewMode::spec ? "spec" : "status");
    const auto width = std::max(40.0f, std::min(520.0f, view.width / view.dpi_scale - 24));
    if (sections.empty()) {
        result.text("pf-review/empty", "関連する本文はありません", {.width = width, .positioned = true, .x = 12, .y = 64}); return;
    }
    const auto section_index = std::min(navigation.section_page, sections.size() - 1);
    const auto& section = sections[section_index];
    auto title_lines = review_text_lines({section.title}, width);
    auto body = section.body;
    const bool long_title = title_lines.size() > 2;
    if (long_title) { body.insert(body.begin(), section.title); title_lines.resize(2); title_lines.back() += "…"; }
    const bool foldable = section.long_body || long_title;
    const bool expanded = !foldable || navigation.expanded.contains(section.id);
    const auto lines = expanded ? review_text_lines(body, width) : std::vector<std::string>{};
    const auto rows = static_cast<std::size_t>(std::max(1.0f, std::floor((view.height / view.dpi_scale - 250 - 28 * title_lines.size()) / 28)));
    const auto pages = std::max(std::size_t{1}, (lines.size() + rows - 1) / rows);
    const auto page = std::min(navigation.text_page, pages - 1);
    result.panel("pf-review/text", [&] {
        result.text("pf-review/section-count", std::to_string(section_index + 1) + " / " + std::to_string(sections.size()), {.height = 28});
        for (std::size_t i = 0; i < title_lines.size(); ++i) result.text("pf-review/heading/" + std::to_string(i), title_lines[i], {.height = 28});
        if (sections.size() > 1) result.panel("pf-review/sections", [&] {
            result.button("pf-review/section-previous", "前の項目", [=]() mutable { navigation.section_page = (section_index + sections.size() - 1) % sections.size(); navigation.text_page = 0; navigate(navigation); }, {.width = (width - 38) / 2, .height = 36});
            result.button("pf-review/section-next", "次の項目", [=]() mutable { navigation.section_page = (section_index + 1) % sections.size(); navigation.text_page = 0; navigate(navigation); }, {.width = (width - 38) / 2, .height = 36});
        }, {.padding = 0, .flow = tela::Flow::row});
        if (foldable) result.button("pf-review/expand", expanded ? "本文を折りたたむ" : "本文を開く", [=]() mutable {
            if (expanded) navigation.expanded.erase(section.id); else navigation.expanded.insert(section.id);
            navigation.text_page = 0; navigate(navigation);
        }, {.height = 36});
        for (auto i = page * rows; i < std::min(lines.size(), (page + 1) * rows); ++i)
            result.text("pf-review/text/" + std::to_string(i), lines[i], {.height = 28, .padding = 2});
        if (pages > 1) result.panel("pf-review/text-pages", [&] {
            result.button("pf-review/text-previous", "< " + std::to_string(page + 1) + "/" + std::to_string(pages), [=]() mutable { navigation.text_page = (page + pages - 1) % pages; navigate(navigation); }, {.width = (width - 38) / 2, .height = 36});
            result.button("pf-review/text-next", ">", [=]() mutable { navigation.text_page = (page + 1) % pages; navigate(navigation); }, {.width = (width - 38) / 2, .height = 36});
        }, {.padding = 0, .flow = tela::Flow::row});
    }, {.width = width, .gap = 0, .positioned = true, .x = std::max(0.0f, view.width / view.dpi_scale - width - 12), .y = 64});
}
