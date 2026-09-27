#pragma once
#include "review_document.hpp"
void review_panel(tela::Document&, const tela::SceneOverlay&, const tela::Viewport&, ReviewNavigation,
    std::function<void(ReviewNavigation)>);
