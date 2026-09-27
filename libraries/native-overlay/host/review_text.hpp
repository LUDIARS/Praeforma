#pragma once
#include <tela/scene_overlay.hpp>

bool is_review_text(const tela::SceneOverlayElement&);
struct ReviewSection { std::string id, title; std::vector<std::string> body; bool long_body{}; };
std::vector<ReviewSection> review_sections(const tela::SceneOverlay&, const std::string& mode);
std::vector<std::string> review_text_lines(const std::vector<std::string>& body, float width);
