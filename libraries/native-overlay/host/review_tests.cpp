#include "review_document.hpp"
#include "review_selection.hpp"
#include "review_text.hpp"
#include <algorithm>
#include <iostream>
#include <stdexcept>

namespace {
void require(bool condition, const char* message) { if (!condition) throw std::runtime_error(message); }
const tela::Element& element(const tela::Document& doc, const std::string& id) {
    const auto found = std::find_if(doc.elements().begin(), doc.elements().end(), [&](const auto& item) { return item.id == id; });
    if (found == doc.elements().end()) throw std::runtime_error("Missing declaration: " + id);
    return *found;
}
}
int main(int argc, char** argv) {
    try {
        if (argc > 1) {
            const auto exported = tela::load_scene_overlay(argv[1]);
            const auto sections = review_sections(exported, "spec");
            require(sections.size() == 1 && sections[0].long_body, "Exported specification did not remain foldable");
            std::string body; for (const auto& line : sections[0].body) body += line;
            require(body.ends_with("FINAL CONDITION"), "Exported specification lost its last condition");
            require(!review_sections(exported, "status").empty(), "Exported status was lost");
        }
        std::vector<tela::SceneOverlayScene> scenes{{"base", "Base", true}, {"review-project", "Project", true}};
        for (int i = 0; i < 20; ++i) scenes.push_back({"scenario" + std::to_string(i), "Scenario " + std::to_string(i), false});
        // UTF-8 multi-byte code points must survive narrower viewports unchanged.
        const std::string text = "\xe6\x97\xa5\xe6\x9c\xac\xe8\xaa\x9e";
        std::vector<tela::SceneOverlayElement> parts;
        parts.push_back({"review-project", "pf-review-heading/spec/long", "text", "Long specification", {0, 0, 1, 1}});
        for (int i = 0; i < 30; ++i) parts.push_back({"review-project", "pf-review-body/spec/long/" + std::to_string(i), "text", text + text, {0, 0, 1, 1}});
        tela::SceneOverlay overlay({"Review", 1280, 720}, scenes, parts);
        const auto sections = review_sections(overlay, "spec");
        require(sections.size() == 1 && sections[0].long_body, "Long specification lost its section");
        const auto narrow = review_text_lines(sections[0].body, 40);
        std::string joined; for (const auto& line : narrow) joined += line;
        std::string expected; for (int i = 0; i < 30; ++i) expected += text + text;
        require(joined == expected, "UTF-8 text was truncated while wrapping");
        tela::Viewport view; view.width = 390; view.height = 480; view.dpi_scale = 1; view.visible = true;
        ReviewNavigation navigation;
        const auto select = [&](const std::string& id) { select_review_page(overlay, id); navigation.text_page = 0; navigation.menu_open = false; };
        const auto navigate = [&](ReviewNavigation next) { navigation = next; };
        auto doc = review_document(overlay, view, navigation, select, navigate);
        require(std::none_of(doc.elements().begin(), doc.elements().end(), [](const auto& item) { return item.id == "pf-review/text"; }), "Elements view mixed in specification text");
        element(doc, "pf-review/mode/1").action();
        doc = review_document(overlay, view, navigation, select, navigate);
        require(std::none_of(doc.elements().begin(), doc.elements().end(), [](const auto& item) { return item.id == "pf-review/text/0"; }), "Long specification was not collapsed");
        element(doc, "pf-review/expand").action();
        doc = review_document(overlay, view, navigation, select, navigate);
        element(doc, "pf-review/text-next").action();
        require(navigation.text_page == 1, "Text pager did not advance");
        element(doc, "pf-review/menu-toggle").action();
        require(navigation.menu_open, "Scenario menu did not open");
        doc = review_document(overlay, view, navigation, select, navigate);
        element(doc, "pf-review/next").action();
        require(navigation.menu_page == 1, "Scenario pager did not advance");
        select("scenario0");
        require(!navigation.menu_open, "Selection did not close the menu");
        require(overlay.scenes()[0].visible && overlay.scenes()[1].visible && overlay.scenes()[2].visible, "Scenario selection is not exclusive");
        select("base"); require(!overlay.scenes()[0].visible && overlay.scenes()[2].visible, "Base toggle changed the active scenario");
        select("scenario1"); require(!overlay.scenes()[2].visible && overlay.scenes()[3].visible, "Scenario extras overlapped");
        select("review-project"); require(!overlay.scenes()[3].visible && overlay.scenes()[1].visible, "Clear scenario hid project specifications");
        view.visible = false;
        require(review_document(overlay, view, navigation, select, navigate).elements().empty(), "Hidden host kept its overlay");
        std::cout << "PASS: text wrapping, paging, selection and hidden viewport\n";
        return 0;
    } catch (const std::exception& error) { std::cerr << error.what() << '\n'; return 1; }
}
