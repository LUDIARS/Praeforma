#include "review_selection.hpp"
#include "review_document.hpp"
#include <tela/bridge.hpp>
#include <tela/windows_overlay.hpp>
#include <tela/windows_pipe.hpp>
#include <windows.h>
#include <chrono>
#include <filesystem>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>

namespace {
std::string utf8(const std::wstring& value) {
    const auto bytes = std::filesystem::path(value).u8string();
    return std::string(bytes.begin(), bytes.end());
}
struct Options { std::string font, pipe; std::filesystem::path document; };
Options options(int argc, wchar_t** argv) {
    Options value;
    for (int i = 1; i < argc; i += 2) {
        if (i + 1 == argc) throw std::invalid_argument("Missing option value");
        const std::wstring arg = argv[i];
        if (arg == L"--font") value.font = utf8(argv[i + 1]);
        else if (arg == L"--scene-overlay") value.document = argv[i + 1];
        else if (arg == L"--pipe") value.pipe = utf8(argv[i + 1]);
        else throw std::invalid_argument("Unknown option");
    }
    if (value.font.empty() || value.document.empty() || value.pipe.empty())
        throw std::invalid_argument("--font, --scene-overlay and --pipe are required");
    return value;
}
void run(const Options& options) {
    tela::Runtime runtime;
    tela::PictorSurface renderer(options.font);
    auto document = tela::load_scene_overlay(options.document);
    tela::BridgeSession bridge(runtime);
    tela::WindowsPipe pipe(options.pipe);
    std::unique_ptr<tela::WindowsOverlay> overlay;
    std::uint64_t connection = 0;
    ReviewNavigation navigation;
    bool dirty = true, running = true;
    const auto started = std::chrono::steady_clock::now();
    while (running) {
        HANDLE wake = reinterpret_cast<HANDLE>(pipe.wake_handle());
        if (MsgWaitForMultipleObjects(1, &wake, FALSE, 1000, QS_ALLINPUT) == WAIT_FAILED)
            throw std::runtime_error("Cannot wait for Tela input");
        MSG message{};
        while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
            if (message.message == WM_QUIT) running = false;
            TranslateMessage(&message); DispatchMessageW(&message);
        }
        for (const auto& event : pipe.drain()) {
            if (!event.message) {
                // The companion has exactly one owner; disconnect terminates it instead of orphaning a window.
                if (!event.error.empty()) throw std::runtime_error(event.error);
                running = false; break;
            }
            if (connection != 0 && event.connection != connection) throw std::runtime_error("Overlay owner changed");
            connection = event.connection;
            if (!bridge.accept(*event.message)) continue;
            if (event.message->kind == tela::BridgeKind::hello) {
                overlay = std::make_unique<tela::WindowsOverlay>(runtime, renderer, bridge.host_window());
                dirty = true;
            }
            if (event.message->kind == tela::BridgeKind::viewport) dirty = true;
        }
        if (!running) break;
        if (!overlay && std::chrono::steady_clock::now() - started > std::chrono::seconds(10))
            throw std::runtime_error("The application did not connect to the Tela companion");
        if (overlay && !IsWindow(reinterpret_cast<HWND>(bridge.host_window()))) break;
        if (dirty) {
            runtime.document(review_document(document, runtime.viewport(), navigation, [&](const std::string& id) {
                select_review_page(document, id); navigation.text_page = 0; navigation.section_page = 0; navigation.menu_open = false; dirty = true;
            }, [&](ReviewNavigation next) { navigation = next; dirty = true; }));
            dirty = false;
        }
        if (overlay) overlay->synchronize();
    }
}
}

int wmain(int argc, wchar_t** argv) {
    try {
        SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        run(options(argc, argv)); return 0;
    } catch (const std::exception& error) {
        std::cerr << "Praeforma Tela: " << error.what() << '\n'; return 1;
    }
}
