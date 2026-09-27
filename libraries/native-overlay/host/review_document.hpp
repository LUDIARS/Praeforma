#pragma once
#include <tela/scene_overlay.hpp>
#include <functional>
#include <set>

enum class ReviewMode { elements, spec, status };
struct ReviewNavigation {
    std::size_t menu_page{}, text_page{}, section_page{}; bool menu_open{};
    ReviewMode mode{ReviewMode::elements}; std::set<std::string> expanded;
};
tela::Document review_document(const tela::SceneOverlay&, const tela::Viewport&, ReviewNavigation,
    std::function<void(const std::string&)> select, std::function<void(ReviewNavigation)> navigate);
