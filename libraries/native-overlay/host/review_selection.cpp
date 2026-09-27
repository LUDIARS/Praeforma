#include "review_selection.hpp"
#include <algorithm>
#include <stdexcept>

void select_review_page(tela::SceneOverlay& document, const std::string& id) {
    const auto selected = std::find_if(document.scenes().begin(), document.scenes().end(),
        [&](const auto& scene) { return scene.id == id; });
    if (selected == document.scenes().end()) throw std::invalid_argument("Unknown review page");
    const bool visible = !selected->visible;
    if (id == "base") { document.set_visible(id, visible); return; }
    // Project metadata is always available. Scenario selection never changes the base toggle.
    for (const auto& scene : document.scenes())
        if (scene.id != "base") document.set_visible(scene.id, scene.id == "review-project" || (scene.id == id && visible));
}
