#include "review_document.hpp"
#include "review_text.hpp"
#include "review_panel.hpp"
#include <algorithm>
#include <cmath>

tela::Document review_document(const tela::SceneOverlay& overlay, const tela::Viewport& view, ReviewNavigation navigation,
    std::function<void(const std::string&)> select, std::function<void(ReviewNavigation)> navigate) {
    tela::Document result;
    if (!view.visible || view.width <= 0 || view.height <= 0 || !(view.dpi_scale > 0)) return result;
    // Keep Tela's frame projection; replace its unbounded controls with a menu that fits the viewport.
    if (navigation.mode == ReviewMode::elements) {
    std::vector<tela::SceneOverlayElement> parts;
    for (const auto& element : overlay.elements()) if (!is_review_text(element)) parts.push_back(element);
    const tela::SceneOverlay placements(overlay.frame(), overlay.scenes(), std::move(parts));
    const auto drawing = tela::scene_overlay_document(placements, view, select);
    for (const auto& element : drawing.elements()) {
        if (!element.parent.empty()) continue;
        if (element.kind == tela::ElementKind::canvas) result.canvas(element.id, element.drawing, element.layout, element.input);
        if (element.kind == tela::ElementKind::text) result.text(element.id, element.label, element.layout, element.input);
    }
    }
    const auto view_width = view.width / view.dpi_scale, view_height = view.height / view.dpi_scale;
    result.button("pf-review/menu-toggle", navigation.menu_open ? "閉じる" : "シナリオ", [navigate, navigation]() mutable {
        navigation.menu_open = !navigation.menu_open; navigate(navigation);
    }, {.width = std::min(96.0f, view_width), .height = 40, .positioned = true, .x = 12, .y = 12});
    const char* labels[] = {"要素", "仕様", "実装・テスト"};
    const auto tab_width = std::max(1.0f, (view_width - 124) / 3);
    for (int i = 0; i < 3; ++i) result.button("pf-review/mode/" + std::to_string(i), labels[i], [=]() mutable {
        navigation.mode = static_cast<ReviewMode>(i); navigation.text_page = 0; navigation.section_page = 0; navigation.menu_open = false; navigate(navigation);
    }, {.width = tab_width, .height = 40, .positioned = true, .x = 112 + tab_width * i, .y = 12});
    if (!navigation.menu_open) {
        if (navigation.mode != ReviewMode::elements) review_panel(result, overlay, view, navigation, navigate);
        return result;
    }
    const auto width = std::max(100.0f, std::min(280.0f, view_width - 24));
    const auto rows = static_cast<std::size_t>(std::max(1.0f, std::floor((view_height - 176) / 46)));
    const auto pages = std::max(std::size_t{1}, (overlay.scenes().size() + rows - 1) / rows);
    const auto page = std::min(navigation.menu_page, pages - 1);
    result.panel("pf-review/menu", [&] {
        result.text("pf-review/title", "Pf " + std::to_string(page + 1) + " / " + std::to_string(pages));
        const auto end = std::min(overlay.scenes().size(), (page + 1) * rows);
        for (auto i = page * rows; i < end; ++i) {
            const auto& scene = overlay.scenes()[i];
            result.button("pf-review/select/" + scene.id, (scene.id == "review-project" ? "" : scene.visible ? "ON " : "OFF ") + scene.name,
                [select, id = scene.id] { select(id); }, {.height = 40});
        }
        if (pages > 1) result.panel("pf-review/pages", [&] {
            result.button("pf-review/previous", "<", [navigate, navigation, page, pages]() mutable { navigation.menu_page = (page + pages - 1) % pages; navigate(navigation); }, {.width = (width - 38) / 2, .height = 40});
            result.button("pf-review/next", ">", [navigate, navigation, page, pages]() mutable { navigation.menu_page = (page + 1) % pages; navigate(navigation); }, {.width = (width - 38) / 2, .height = 40});
        }, {.padding = 0, .flow = tela::Flow::row});
    }, {.width = width, .positioned = true, .x = 12, .y = 64});
    return result;
}
