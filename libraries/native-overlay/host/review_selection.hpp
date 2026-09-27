#pragma once
#include <tela/scene_overlay.hpp>

// Pf-specific selection policy; Tela remains the renderer and native input owner.
void select_review_page(tela::SceneOverlay& document, const std::string& id);
