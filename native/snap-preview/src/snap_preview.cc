// Liner snap preview (windows).
//
// The drag-to-top "maximize" preview, done the way windows' own snap preview is:
// a popup window whose content is a Windows.UI.Composition visual tree that lives in
// DWM. The blur is a HostBackdropBrush (DWM's live blur of everything behind the
// window) and the growing / collapsing box is a rounded clip driven by expression
// animations over a property set. Keyframe animations run in the compositor at the
// display refresh rate, so the app does no per-frame work at all: JS only says
// "animate from A to B" (and, while collapsing, updates B as the window moves).
//
// Exposed (all coordinates in physical pixels; rects are [left, top, right, bottom]
// relative to the preview window, which covers one display's work area):
//   init() -> bool                 create window + compositor (false: unsupported)
//   hasBackdrop() -> bool          live blur available (windows 11)
//   placeOnCursorMonitor() -> [x, y, w, h]
//                                  cover the work area (taskbar excluded) of the monitor
//                                  under the cursor, straight from windows (physical px)
//   windowRect(hwndBuffer) -> [l, t, r, b]   visible screen rect of a window (physical px)
//   setArea(x, y, w, h)            place / size the window (only while hidden)
//   setStyle(argbTint, radiusPx)
//   show(afterHwndBuffer | null)   show without activating, just below that window
//   hide()
//   animate(from, to, ms, [x1, y1, x2, y2])   cubic-bezier easing
//   setTarget(to)                  move the end of a running animation (live follow)
//   placeOnWindowMonitor(hwndBuffer) -> [x, y, w, h]   like placeOnCursorMonitor, for a window
//   beginMorph(hwndBuffer)         maximize / restore animation, step 1: a live DWM
//                                  thumbnail of that window takes its place and the
//                                  window itself is cloaked (it resizes unseen)
//   runMorph(from, to, ms, [x1, y1, x2, y2])   step 2 (screen px edges): a vsync-paced
//                                  thread (DwmFlush) moves the thumbnail from -> to, then
//                                  uncloaks the window right where it landed and drops it
//   runMorph(..., autoReveal = true)   autoReveal false: stay cloaked when it lands and
//                                  wait for revealMorph() (the window resizes after the
//                                  shrink, then is revealed once it has painted)
//   revealMorph()                  uncloak the window and drop the thumbnail (vsync-paced)
//   beginMorph(hwnd, fromEdges?, opacity?)   start the thumbnail at a given screen rect
//                                  and opacity (0-255) instead of on the window itself
//   runMorph(..., autoReveal, opacityFrom, opacityTo)   fades the thumbnail as it moves
//                                  (window <-> overlay pill)
//   setMorphTarget(to)             move where a running morph lands (screen px edges),
//                                  e.g. a window dragged out of maximize keeps moving
//   endMorph()                     safety net: uncloak + drop the thumbnail now
//   cloak(hwnd, on)                hide / show a window of ours without unmapping it
//                                  (it keeps painting, its DWM thumbnail stays live)
//   transform(from, to, ms, bezier, radiusFrom, radiusTo, outHwnd, inHwnd)
//                                  container transform (material motion): the box (live
//                                  blur + tint) moves from -> to while its corner radius
//                                  morphs; outHwnd's live thumbnail fades out early, inHwnd's
//                                  fades in late (fade-through), both fitted inside the
//                                  box. outHwnd is cloaked at the start; inHwnd must be
//                                  cloaked by the caller and is revealed exactly where the
//                                  box lands. outHwnd stays cloaked (caller hides it).
//   endTransform()                 safety net: drop the transform thumbnails now
//   destroy()

// composition interop needs windows 8+ declarations (node-gyp defaults lower)
#ifdef _WIN32_WINNT
#undef _WIN32_WINNT
#endif
#define _WIN32_WINNT 0x0A00

#include <windows.h>
#include <dwmapi.h>
#include <commctrl.h>
#include <unknwn.h>
#include <DispatcherQueue.h>
#include <windows.ui.composition.interop.h>

#include <winrt/base.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Numerics.h>
#include <winrt/Windows.System.h>
#include <winrt/Windows.UI.h>
#include <winrt/Windows.UI.Composition.h>
#include <winrt/Windows.UI.Composition.Desktop.h>

#include <node_api.h>

#include <chrono>
#include <cstdint>
#include <cstring>
#include <initializer_list>
#include <string>
#include <cstdio>
#include <atomic>
#include <cmath>
#include <mutex>
#include <thread>

namespace wuc = winrt::Windows::UI::Composition;
namespace wucd = winrt::Windows::UI::Composition::Desktop;
using winrt::Windows::Foundation::Numerics::float2;

#ifndef DWMWA_USE_HOSTBACKDROPBRUSH
#define DWMWA_USE_HOSTBACKDROPBRUSH 17
#endif
#ifndef DWMWA_WINDOW_CORNER_PREFERENCE
#define DWMWA_WINDOW_CORNER_PREFERENCE 33
#endif

namespace {

struct State {
  HWND hwnd = nullptr;
  winrt::Windows::System::DispatcherQueueController queue{nullptr};
  wuc::Compositor compositor{nullptr};
  wucd::DesktopWindowTarget target{nullptr};
  wuc::ContainerVisual root{nullptr};
  wuc::ContainerVisual box{nullptr};
  wuc::SpriteVisual backdrop{nullptr};
  wuc::SpriteVisual tintVisual{nullptr};
  wuc::CompositionColorBrush tint{nullptr};
  wuc::CompositionPropertySet props{nullptr};
  wuc::RectangleClip roundClip{nullptr};
  wuc::InsetClip insetClip{nullptr};
  bool hasBackdrop = false;
};

State g;
std::string g_lastError;  // why init() failed (lastError())
bool g_radiusAnimated = false;  // corner radius driven by expressions (else static)

void SetError(char const* where, HRESULT hr) {
  char buf[160];
  snprintf(buf, sizeof(buf), "%s failed (hr=0x%08lx)", where, static_cast<unsigned long>(hr));
  g_lastError = buf;
}

LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
  switch (msg) {
    case WM_NCHITTEST:
      return HTTRANSPARENT;  // never takes the mouse
    case WM_MOUSEACTIVATE:
      return MA_NOACTIVATE;
    case WM_ERASEBKGND:
      return 1;
    default:
      return DefWindowProcW(hwnd, msg, wp, lp);
  }
}

bool EnsureDispatcherQueue() {
  if (winrt::Windows::System::DispatcherQueue::GetForCurrentThread()) return true;
  DispatcherQueueOptions options{sizeof(DispatcherQueueOptions), DQTYPE_THREAD_CURRENT, DQTAT_COM_NONE};
  winrt::Windows::System::DispatcherQueueController controller{nullptr};
  HRESULT hr = CreateDispatcherQueueController(
      options, reinterpret_cast<ABI::Windows::System::IDispatcherQueueController**>(winrt::put_abi(controller)));
  if (FAILED(hr)) return false;
  g.queue = controller;
  return true;
}

void BindClipExpressions() {
  auto bind = [&](wuc::CompositionObject const& clip, wchar_t const* property, wchar_t const* expression) {
    auto expr = g.compositor.CreateExpressionAnimation(expression);
    expr.SetReferenceParameter(L"p", g.props);
    clip.StartAnimation(property, expr);
  };
  if (g.roundClip) {
    // a morphing corner radius is a nice-to-have: if the compositor refuses it, keep
    // static corners instead of failing the whole preview
    try {
      wchar_t const* radius = L"Vector2(Lerp(p.RF, p.RT, p.P), Lerp(p.RF, p.RT, p.P))";
      bind(g.roundClip, L"TopLeftRadius", radius);
      bind(g.roundClip, L"TopRightRadius", radius);
      bind(g.roundClip, L"BottomLeftRadius", radius);
      bind(g.roundClip, L"BottomRightRadius", radius);
      g_radiusAnimated = true;
    } catch (...) {
      g_radiusAnimated = false;
    }
    bind(g.roundClip, L"Left", L"Lerp(p.FL, p.TL, p.P)");
    bind(g.roundClip, L"Top", L"Lerp(p.FT, p.TT, p.P)");
    bind(g.roundClip, L"Right", L"Lerp(p.FR, p.TR, p.P)");
    bind(g.roundClip, L"Bottom", L"Lerp(p.FB, p.TB, p.P)");
  } else {
    bind(g.insetClip, L"LeftInset", L"Lerp(p.FL, p.TL, p.P)");
    bind(g.insetClip, L"TopInset", L"Lerp(p.FT, p.TT, p.P)");
    bind(g.insetClip, L"RightInset", L"p.W - Lerp(p.FR, p.TR, p.P)");
    bind(g.insetClip, L"BottomInset", L"p.H - Lerp(p.FB, p.TB, p.P)");
  }
}

bool Init() {
  if (g.hwnd) return true;
  try {
    if (!EnsureDispatcherQueue()) {
      g_lastError = "CreateDispatcherQueueController failed";
      return false;
    }

    HINSTANCE instance = GetModuleHandleW(nullptr);
    WNDCLASSEXW wc{};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = instance;
    wc.lpszClassName = L"LinerSnapPreview";
    RegisterClassExW(&wc);  // fails harmlessly if already registered

    g.hwnd = CreateWindowExW(WS_EX_NOREDIRECTIONBITMAP | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE, wc.lpszClassName,
                             L"", WS_POPUP, 0, 0, 1, 1, nullptr, nullptr, instance, nullptr);
    if (!g.hwnd) {
      SetError("CreateWindowEx", HRESULT_FROM_WIN32(GetLastError()));
      return false;
    }

    BOOL on = TRUE;
    // live blur of what is behind the window (windows 11); fails on windows 10
    g.hasBackdrop = SUCCEEDED(DwmSetWindowAttribute(g.hwnd, DWMWA_USE_HOSTBACKDROPBRUSH, &on, sizeof(on)));
    // we animate ourselves; no dwm show / hide fades, no system corner rounding
    DwmSetWindowAttribute(g.hwnd, DWMWA_TRANSITIONS_FORCEDISABLED, &on, sizeof(on));
    int noRound = 1;  // DWMWCP_DONOTROUND
    DwmSetWindowAttribute(g.hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, &noRound, sizeof(noRound));

    g.compositor = wuc::Compositor();
    auto interop = g.compositor.as<ABI::Windows::UI::Composition::Desktop::ICompositorDesktopInterop>();
    wucd::DesktopWindowTarget target{nullptr};
    winrt::check_hresult(interop->CreateDesktopWindowTarget(
        g.hwnd, TRUE,
        reinterpret_cast<ABI::Windows::UI::Composition::Desktop::IDesktopWindowTarget**>(winrt::put_abi(target))));
    g.target = target;

    g.root = g.compositor.CreateContainerVisual();
    g.root.RelativeSizeAdjustment(float2{1.f, 1.f});
    g.target.Root(g.root);

    g.box = g.compositor.CreateContainerVisual();
    g.box.RelativeSizeAdjustment(float2{1.f, 1.f});
    g.root.Children().InsertAtTop(g.box);

    if (g.hasBackdrop) {
      g.backdrop = g.compositor.CreateSpriteVisual();
      g.backdrop.RelativeSizeAdjustment(float2{1.f, 1.f});
      g.backdrop.Brush(g.compositor.CreateHostBackdropBrush());
      g.box.Children().InsertAtTop(g.backdrop);
    }
    g.tint = g.compositor.CreateColorBrush(winrt::Windows::UI::Color{0x29, 0x80, 0x80, 0x80});
    g.tintVisual = g.compositor.CreateSpriteVisual();
    g.tintVisual.RelativeSizeAdjustment(float2{1.f, 1.f});
    g.tintVisual.Brush(g.tint);
    g.box.Children().InsertAtTop(g.tintVisual);

    g.props = g.compositor.CreatePropertySet();
    for (wchar_t const* key :
         {L"FL", L"FT", L"FR", L"FB", L"TL", L"TT", L"TR", L"TB", L"P", L"W", L"H", L"RF", L"RT"}) {
      g.props.InsertScalar(key, 0.f);
    }

    // rounded clip needs windows 10 2004+; older builds get square corners
    try {
      g.roundClip = g.compositor.CreateRectangleClip();
      g.box.Clip(g.roundClip);
    } catch (...) {
      g.roundClip = nullptr;
      g.insetClip = g.compositor.CreateInsetClip();
      g.box.Clip(g.insetClip);
    }
    BindClipExpressions();  // all zero: an empty box
    g_lastError.clear();
    return true;
  } catch (winrt::hresult_error const& e) {
    SetError(winrt::to_string(e.message()).c_str(), e.code());
  } catch (...) {
    g_lastError = "unknown exception during init";
  }
  if (g.hwnd) DestroyWindow(g.hwnd);
  g = State{};
  return false;
}

void Destroy() {
  try {
    if (g.target) g.target.Root(nullptr);
  } catch (...) {
  }
  if (g.hwnd) DestroyWindow(g.hwnd);
  auto queue = g.queue;
  g = State{};
  g.queue = queue;  // the thread's dispatcher queue stays for a later init()
}

float g_areaW = 0, g_areaH = 0;
int g_areaX = 0, g_areaY = 0;

// never outside the work area: the box can't reach the taskbar whatever JS sends
// the box is fully opaque except during a transform (which fades it in and out)
void ResetBoxOpacity() {
  try {
    if (!g.box) return;
    g.box.StopAnimation(L"Opacity");
    g.box.Opacity(1.f);
  } catch (...) {
  }
}

void SetEdges(wchar_t const* prefix, float const* r) {
  wchar_t key[3] = {prefix[0], 0, 0};
  static wchar_t const edges[4] = {L'L', L'T', L'R', L'B'};
  for (int i = 0; i < 4; ++i) {
    float limit = (i % 2 == 0) ? g_areaW : g_areaH;
    float v = r[i];
    if (limit > 0) v = v < 0 ? 0 : (v > limit ? limit : v);
    key[1] = edges[i];
    g.props.InsertScalar(key, v);
  }
}

void ApplyArea(int x, int y, int w, int h) {
  SetWindowPos(g.hwnd, nullptr, x, y, w, h, SWP_NOACTIVATE | SWP_NOZORDER);
  g_areaX = x;
  g_areaY = y;
  g_areaW = static_cast<float>(w);
  g_areaH = static_cast<float>(h);
  try {
    g.props.InsertScalar(L"W", g_areaW);
    g.props.InsertScalar(L"H", g_areaH);
  } catch (...) {
  }
}

napi_value NumberArray(napi_env env, std::initializer_list<double> values) {
  napi_value arr;
  napi_create_array_with_length(env, values.size(), &arr);
  uint32_t i = 0;
  for (double v : values) {
    napi_value n;
    napi_create_double(env, v, &n);
    napi_set_element(env, arr, i++, n);
  }
  return arr;
}

// ---------- maximize / restore morph ----------

std::mutex g_morphLock;
HTHUMBNAIL g_thumb = nullptr;
HWND g_morphWindow = nullptr;
std::atomic<int> g_morphToken{0};
double g_morphTo[4] = {0, 0, 0, 0};  // live landing rect (guarded by g_morphLock)

void Cloak(HWND hwnd, bool on) {
  if (!hwnd || !IsWindow(hwnd)) return;
  BOOL value = on ? TRUE : FALSE;
  DwmSetWindowAttribute(hwnd, DWMWA_CLOAK, &value, sizeof(value));
}

void SetTransitionsDisabled(HWND hwnd, bool disabled) {
  if (!hwnd || !IsWindow(hwnd)) return;
  BOOL value = disabled ? TRUE : FALSE;
  DwmSetWindowAttribute(hwnd, DWMWA_TRANSITIONS_FORCEDISABLED, &value, sizeof(value));
}

void MinimizeKeepingPreview(HWND hwnd) {
  if (!hwnd || !IsWindow(hwnd)) return;
  WINDOWPLACEMENT before{};
  before.length = sizeof(before);
  if (!GetWindowPlacement(hwnd, &before)) {
    Cloak(hwnd, false);
    ShowWindow(hwnd, SW_MINIMIZE);
    return;
  }
  SetTransitionsDisabled(hwnd, true);
  SetWindowPos(hwnd, nullptr, -32000, -32000, 0, 0,
               SWP_NOSIZE | SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_NOACTIVATE | SWP_NOREDRAW);
  Cloak(hwnd, false);
  ShowWindow(hwnd, SW_MINIMIZE);
  WINDOWPLACEMENT after{};
  after.length = sizeof(after);
  if (GetWindowPlacement(hwnd, &after)) {
    after.rcNormalPosition = before.rcNormalPosition;
    after.ptMaxPosition = before.ptMaxPosition;
    after.showCmd = SW_SHOWMINIMIZED;
    SetWindowPlacement(hwnd, &after);
  }
}

constexpr UINT_PTR kRestoreTrapId = 0x4c4e5254;
HWND g_restoreTrapArmed = nullptr;
std::atomic<bool> g_restoredCloaked{false};

void SpringRestoreTrap(HWND hwnd) {
  if (g_restoreTrapArmed != hwnd) return;
  g_restoreTrapArmed = nullptr;
  Cloak(hwnd, true);
  g_restoredCloaked = true;
}

LRESULT CALLBACK RestoreTrapProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam, UINT_PTR id, DWORD_PTR) {
  switch (msg) {
    case WM_QUERYOPEN:
      SpringRestoreTrap(hwnd);
      break;
    case WM_WINDOWPOSCHANGING: {
      auto const* pos = reinterpret_cast<WINDOWPOS const*>(lParam);
      bool movesOnScreen = pos && !(pos->flags & SWP_NOMOVE) && pos->x > -30000 && pos->y > -30000;
      if (IsIconic(hwnd) && movesOnScreen) SpringRestoreTrap(hwnd);
      break;
    }
    case WM_NCDESTROY:
      if (g_restoreTrapArmed == hwnd) g_restoreTrapArmed = nullptr;
      RemoveWindowSubclass(hwnd, RestoreTrapProc, id);
      break;
  }
  return DefSubclassProc(hwnd, msg, wParam, lParam);
}

void ArmRestoreTrap(HWND hwnd, bool armed) {
  if (!hwnd || !IsWindow(hwnd)) return;
  if (!armed) {
    if (g_restoreTrapArmed == hwnd) g_restoreTrapArmed = nullptr;
    return;
  }
  SetWindowSubclass(hwnd, RestoreTrapProc, kRestoreTrapId, 0);
  g_restoredCloaked = false;
  g_restoreTrapArmed = hwnd;
}

void PlaceThumb(HTHUMBNAIL thumb, RECT const& dest, BYTE opacity = 255) {
  DWM_THUMBNAIL_PROPERTIES props{};
  props.dwFlags = DWM_TNP_RECTDESTINATION | DWM_TNP_VISIBLE | DWM_TNP_SOURCECLIENTAREAONLY | DWM_TNP_OPACITY;
  props.rcDestination = dest;
  props.fVisible = TRUE;
  props.fSourceClientAreaOnly = FALSE;
  props.opacity = opacity;
  DwmUpdateThumbnailProperties(thumb, &props);
}

// screen px edges -> preview-window-local rect
RECT LocalRect(double l, double t, double r, double b) {
  return RECT{static_cast<LONG>(std::lround(l - g_areaX)), static_cast<LONG>(std::lround(t - g_areaY)),
              static_cast<LONG>(std::lround(r - g_areaX)), static_cast<LONG>(std::lround(b - g_areaY))};
}

// uncloak whatever is cloaked and drop the thumbnail (idempotent)
void EndMorphNow() {
  std::lock_guard<std::mutex> lock(g_morphLock);
  if (g_morphWindow) Cloak(g_morphWindow, false);
  if (g_thumb) DwmUnregisterThumbnail(g_thumb);
  g_thumb = nullptr;
  g_morphWindow = nullptr;
}

bool BeginMorph(HWND window, const float* fromOverride = nullptr, BYTE opacity = 255) {
  if (!g.hwnd || !window) return false;
  ++g_morphToken;  // cancels a running morph (it stops touching the thumbnail)
  EndMorphNow();
  HTHUMBNAIL thumb = nullptr;
  if (FAILED(DwmRegisterThumbnail(g.hwnd, window, &thumb)) || !thumb) return false;
  if (fromOverride) {
    PlaceThumb(thumb, LocalRect(fromOverride[0], fromOverride[1], fromOverride[2], fromOverride[3]), opacity);
  } else {
    RECT r{};
    if (FAILED(DwmGetWindowAttribute(window, DWMWA_EXTENDED_FRAME_BOUNDS, &r, sizeof(r)))) GetWindowRect(window, &r);
    PlaceThumb(thumb, LocalRect(r.left, r.top, r.right, r.bottom), opacity);
  }
  {
    std::lock_guard<std::mutex> lock(g_morphLock);
    g_thumb = thumb;
    g_morphWindow = window;
  }
  DwmFlush();  // the thumbnail is on screen before the window goes away
  Cloak(window, true);
  return true;
}

// css-style cubic-bezier, same curve the js side uses
double Bezier(double x1, double y1, double x2, double y2, double t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  double cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  double cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  auto sx = [&](double u) { return ((ax * u + bx) * u + cx) * u; };
  auto sy = [&](double u) { return ((ay * u + by) * u + cy) * u; };
  double lo = 0, hi = 1, u = t;
  for (int i = 0; i < 40; ++i) {
    double x = sx(u);
    if (std::fabs(x - t) < 1e-6) break;
    if (x < t) lo = u;
    else hi = u;
    u = (lo + hi) / 2;
  }
  return sy(u);
}

// reveal the real window right under the thumbnail, then drop the thumbnail
void RevealMorph(int token) {
  HWND window;
  {
    std::lock_guard<std::mutex> lock(g_morphLock);
    window = g_morphWindow;
  }
  Cloak(window, false);
  DwmFlush();
  DwmFlush();
  if (g_morphToken.load() == token) EndMorphNow();
}

void RunMorph(const float* from, const float* to, double ms, const float* bez, bool autoReveal, double opFrom = 255,
              double opTo = 255) {
  int token = ++g_morphToken;
  HTHUMBNAIL thumb;
  {
    std::lock_guard<std::mutex> lock(g_morphLock);
    thumb = g_thumb;
  }
  if (!thumb) return;
  double f[4] = {from[0], from[1], from[2], from[3]};
  double b[4] = {bez[0], bez[1], bez[2], bez[3]};
  {
    std::lock_guard<std::mutex> lock(g_morphLock);
    for (int i = 0; i < 4; ++i) g_morphTo[i] = to[i];
  }
  std::thread([=]() {
    // let the (cloaked) window paint at its new size first
    DwmFlush();
    DwmFlush();
    auto start = std::chrono::steady_clock::now();
    for (;;) {
      if (g_morphToken.load() != token) return;  // superseded: the next morph owns it
      double elapsed = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count();
      double k = ms > 0 ? (elapsed / ms < 1 ? elapsed / ms : 1) : 1;
      double e = Bezier(b[0], b[1], b[2], b[3], k);
      {
        std::lock_guard<std::mutex> lock(g_morphLock);
        if (g_thumb != thumb) return;
        double const* t4 = g_morphTo;  // re-read every frame: the target may move
        // opacity follows time linearly-ish (eased), so a fade reads evenly
        double op = opFrom + (opTo - opFrom) * e;
        if (op < 0) op = 0;
        if (op > 255) op = 255;
        PlaceThumb(thumb,
                   LocalRect(f[0] + (t4[0] - f[0]) * e, f[1] + (t4[1] - f[1]) * e, f[2] + (t4[2] - f[2]) * e,
                             f[3] + (t4[3] - f[3]) * e),
                   static_cast<BYTE>(op + 0.5));
      }
      if (k >= 1) break;
      DwmFlush();  // one step per composed frame (vsync)
    }
    // landed exactly on the window: reveal it (unless the caller resizes first)
    if (autoReveal) RevealMorph(token);
  }).detach();
}

// ---------- container transform (window <-> overlay) ----------

std::mutex g_xfLock;
HTHUMBNAIL g_xfOut = nullptr;
HTHUMBNAIL g_xfIn = nullptr;
std::atomic<int> g_xfToken{0};

void EndTransformNow() {
  std::lock_guard<std::mutex> lock(g_xfLock);
  if (g_xfOut) DwmUnregisterThumbnail(g_xfOut);
  if (g_xfIn) DwmUnregisterThumbnail(g_xfIn);
  g_xfOut = nullptr;
  g_xfIn = nullptr;
}

// a thumbnail's source fitted (contain, centred) inside a screen rect
RECT FitInside(HTHUMBNAIL thumb, double l, double t, double r, double b) {
  SIZE src{};
  if (FAILED(DwmQueryThumbnailSourceSize(thumb, &src)) || src.cx <= 0 || src.cy <= 0) return LocalRect(l, t, r, b);
  double w = r - l, h = b - t;
  double scale = (w / src.cx < h / src.cy) ? w / src.cx : h / src.cy;
  double fw = src.cx * scale, fh = src.cy * scale;
  double cx = (l + r) / 2, cy = (t + b) / 2;
  return LocalRect(cx - fw / 2, cy - fh / 2, cx + fw / 2, cy + fh / 2);
}

double Clamp01(double v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

bool Transform(const float* from, const float* to, double ms, const float* bez, float rFrom, float rTo, HWND outW,
               HWND inW) {
  if (!g.hwnd || !outW || !inW) return false;
  int token = ++g_xfToken;
  EndTransformNow();
  HTHUMBNAIL tOut = nullptr, tIn = nullptr;
  if (FAILED(DwmRegisterThumbnail(g.hwnd, outW, &tOut)) || !tOut) return false;
  if (FAILED(DwmRegisterThumbnail(g.hwnd, inW, &tIn)) || !tIn) {
    DwmUnregisterThumbnail(tOut);
    return false;
  }
  {
    std::lock_guard<std::mutex> lock(g_xfLock);
    g_xfOut = tOut;
    g_xfIn = tIn;
  }
  PlaceThumb(tOut, FitInside(tOut, from[0], from[1], from[2], from[3]), 255);
  PlaceThumb(tIn, FitInside(tIn, from[0], from[1], from[2], from[3]), 0);

  // the box (compositor-animated): from -> to, radius rFrom -> rTo
  try {
    float lf[4] = {from[0] - g_areaX, from[1] - g_areaY, from[2] - g_areaX, from[3] - g_areaY};
    float lt[4] = {to[0] - g_areaX, to[1] - g_areaY, to[2] - g_areaX, to[3] - g_areaY};
    g.props.StopAnimation(L"P");
    SetEdges(L"F", lf);
    SetEdges(L"T", lt);
    g.props.InsertScalar(L"RF", rFrom);
    g.props.InsertScalar(L"RT", rTo);
    g.props.InsertScalar(L"P", 0.f);
    auto easing = g.compositor.CreateCubicBezierEasingFunction(float2{bez[0], bez[1]}, float2{bez[2], bez[3]});
    auto animation = g.compositor.CreateScalarKeyFrameAnimation();
    animation.InsertKeyFrame(0.f, 0.f);
    animation.InsertKeyFrame(1.f, 1.f, easing);
    animation.Duration(std::chrono::milliseconds(static_cast<int64_t>(ms)));
    g.props.StartAnimation(L"P", animation);

    // the container only exists in flight: it fades in just after the start and out
    // over the last stretch, so at both ends only a picture identical to the real
    // window is on screen (the windows' transparent margins never show the box)
    auto fade = g.compositor.CreateScalarKeyFrameAnimation();
    auto linear = g.compositor.CreateLinearEasingFunction();
    fade.InsertKeyFrame(0.f, 0.f);
    fade.InsertKeyFrame(0.18f, 1.f, linear);
    fade.InsertKeyFrame(0.7f, 1.f, linear);
    fade.InsertKeyFrame(1.f, 0.f, linear);
    fade.Duration(std::chrono::milliseconds(static_cast<int64_t>(ms)));
    g.box.Opacity(0.f);
    g.box.StartAnimation(L"Opacity", fade);
  } catch (...) {
  }

  DwmFlush();  // thumbnail + box on screen before the real window goes away
  Cloak(outW, true);

  double f[4] = {from[0], from[1], from[2], from[3]};
  double t4[4] = {to[0], to[1], to[2], to[3]};
  double b[4] = {bez[0], bez[1], bez[2], bez[3]};
  std::thread([=]() {
    auto start = std::chrono::steady_clock::now();
    for (;;) {
      if (g_xfToken.load() != token) return;
      double elapsed = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count();
      double k = ms > 0 ? Clamp01(elapsed / ms) : 1;
      double e = Bezier(b[0], b[1], b[2], b[3], k);
      double l = f[0] + (t4[0] - f[0]) * e, t = f[1] + (t4[1] - f[1]) * e;
      double r = f[2] + (t4[2] - f[2]) * e, bt = f[3] + (t4[3] - f[3]) * e;
      // fade-through: the old content is gone by 30%; the new one starts appearing at a
      // quarter and is fully there by 70%, so it reads while the shape still moves
      double outOp = 1 - Clamp01(k / 0.3);
      outOp = outOp * outOp * (3 - 2 * outOp);
      double inOp = Clamp01((k - 0.25) / 0.45);
      inOp = inOp * inOp * (3 - 2 * inOp);  // smoothstep: no hard edges
      {
        std::lock_guard<std::mutex> lock(g_xfLock);
        if (g_xfOut != tOut) return;
        PlaceThumb(tOut, FitInside(tOut, l, t, r, bt), static_cast<BYTE>(outOp * 255 + 0.5));
        PlaceThumb(tIn, FitInside(tIn, l, t, r, bt), static_cast<BYTE>(inOp * 255 + 0.5));
      }
      if (k >= 1) break;
      DwmFlush();
    }
    // landed on the incoming window exactly: reveal it, then drop the thumbnails
    Cloak(inW, false);
    DwmFlush();
    DwmFlush();
    if (g_xfToken.load() == token) EndTransformNow();
  }).detach();
  return true;
}

// ---------- n-api glue ----------

bool ReadRect(napi_env env, napi_value value, float* out) {
  bool isArray = false;
  if (napi_is_array(env, value, &isArray) != napi_ok || !isArray) return false;
  for (uint32_t i = 0; i < 4; ++i) {
    napi_value item;
    double d = 0;
    if (napi_get_element(env, value, i, &item) != napi_ok || napi_get_value_double(env, item, &d) != napi_ok) {
      return false;
    }
    out[i] = static_cast<float>(d);
  }
  return true;
}

double ArgNumber(napi_env env, napi_value value, double fallback = 0) {
  double d = fallback;
  napi_get_value_double(env, value, &d);
  return d;
}

napi_value Bool(napi_env env, bool v) {
  napi_value out;
  napi_get_boolean(env, v, &out);
  return out;
}

napi_value Undefined(napi_env env) {
  napi_value out;
  napi_get_undefined(env, &out);
  return out;
}

template <size_t N>
bool Args(napi_env env, napi_callback_info info, napi_value (&argv)[N], size_t& argc) {
  argc = N;
  return napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) == napi_ok;
}

napi_value JsInit(napi_env env, napi_callback_info) { return Bool(env, Init()); }

napi_value JsHasBackdrop(napi_env env, napi_callback_info) { return Bool(env, g.hasBackdrop); }

napi_value JsLastError(napi_env env, napi_callback_info) {
  napi_value out;
  napi_create_string_utf8(env, g_lastError.c_str(), g_lastError.size(), &out);
  return out;
}

napi_value JsSetArea(napi_env env, napi_callback_info info) {
  napi_value argv[4];
  size_t argc;
  if (!g.hwnd || !Args(env, info, argv, argc) || argc < 4) return Undefined(env);
  ApplyArea(static_cast<int>(ArgNumber(env, argv[0])), static_cast<int>(ArgNumber(env, argv[1])),
            static_cast<int>(ArgNumber(env, argv[2], 1)), static_cast<int>(ArgNumber(env, argv[3], 1)));
  return Undefined(env);
}

napi_value JsPlaceOnCursorMonitor(napi_env env, napi_callback_info) {
  if (!g.hwnd) return Undefined(env);
  POINT pt{};
  GetCursorPos(&pt);
  MONITORINFO mi{};
  mi.cbSize = sizeof(mi);
  if (!GetMonitorInfoW(MonitorFromPoint(pt, MONITOR_DEFAULTTONEAREST), &mi)) return Undefined(env);
  RECT const& r = mi.rcWork;  // excludes the taskbar (and app bars)
  ApplyArea(r.left, r.top, r.right - r.left, r.bottom - r.top);
  return NumberArray(env, {static_cast<double>(r.left), static_cast<double>(r.top),
                           static_cast<double>(r.right - r.left), static_cast<double>(r.bottom - r.top)});
}

HWND HwndFrom(napi_env env, napi_value value) {
  bool isBuffer = false;
  if (napi_is_buffer(env, value, &isBuffer) != napi_ok || !isBuffer) return nullptr;
  void* data = nullptr;
  size_t length = 0;
  if (napi_get_buffer_info(env, value, &data, &length) != napi_ok || length < sizeof(HWND)) return nullptr;
  HWND hwnd = nullptr;
  std::memcpy(&hwnd, data, sizeof(HWND));
  return hwnd;
}

napi_value JsWindowRect(napi_env env, napi_callback_info info) {
  napi_value argv[1];
  size_t argc;
  if (!Args(env, info, argv, argc) || argc < 1) return Undefined(env);
  HWND hwnd = HwndFrom(env, argv[0]);
  if (!hwnd) return Undefined(env);
  RECT r{};
  // the visible frame (no invisible resize borders), in physical pixels
  if (FAILED(DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, &r, sizeof(r)))) {
    if (!GetWindowRect(hwnd, &r)) return Undefined(env);
  }
  return NumberArray(env, {static_cast<double>(r.left), static_cast<double>(r.top), static_cast<double>(r.right),
                           static_cast<double>(r.bottom)});
}

napi_value JsSetStyle(napi_env env, napi_callback_info info) {
  napi_value argv[2];
  size_t argc;
  if (!g.hwnd || !Args(env, info, argv, argc) || argc < 2) return Undefined(env);
  uint32_t argb = static_cast<uint32_t>(ArgNumber(env, argv[0]));
  float radius = static_cast<float>(ArgNumber(env, argv[1]));
  try {
    g.tint.Color(winrt::Windows::UI::Color{static_cast<uint8_t>(argb >> 24), static_cast<uint8_t>(argb >> 16),
                                           static_cast<uint8_t>(argb >> 8), static_cast<uint8_t>(argb)});
    // the corner radius is an expression (it can morph during a transform)
    g.props.InsertScalar(L"RF", radius);
    g.props.InsertScalar(L"RT", radius);
    if (g.roundClip && !g_radiusAnimated) {
      float2 r{radius, radius};
      g.roundClip.TopLeftRadius(r);
      g.roundClip.TopRightRadius(r);
      g.roundClip.BottomLeftRadius(r);
      g.roundClip.BottomRightRadius(r);
    }
  } catch (...) {
  }
  return Undefined(env);
}

napi_value JsShow(napi_env env, napi_callback_info info) {
  napi_value argv[1];
  size_t argc;
  if (!g.hwnd || !Args(env, info, argv, argc)) return Undefined(env);
  HWND after = HWND_TOP;
  if (argc >= 1) {
    HWND below = HwndFrom(env, argv[0]);  // just below our app window
    if (below) after = below;
  }
  SetWindowPos(g.hwnd, after, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
  return Undefined(env);
}

napi_value JsHide(napi_env env, napi_callback_info) {
  if (g.hwnd) ShowWindow(g.hwnd, SW_HIDE);
  return Undefined(env);
}

napi_value JsAnimate(napi_env env, napi_callback_info info) {
  napi_value argv[4];
  size_t argc;
  float from[4], to[4], bezier[4] = {0.33f, 1.f, 0.68f, 1.f};
  if (!g.hwnd || !Args(env, info, argv, argc) || argc < 3) return Undefined(env);
  if (!ReadRect(env, argv[0], from) || !ReadRect(env, argv[1], to)) return Undefined(env);
  double ms = ArgNumber(env, argv[2], 0);
  if (argc >= 4) ReadRect(env, argv[3], bezier);
  try {
    ResetBoxOpacity();
    g.props.StopAnimation(L"P");
    SetEdges(L"F", from);
    SetEdges(L"T", to);
    if (ms <= 0) {
      g.props.InsertScalar(L"P", 1.f);
      return Undefined(env);
    }
    g.props.InsertScalar(L"P", 0.f);
    auto easing = g.compositor.CreateCubicBezierEasingFunction(float2{bezier[0], bezier[1]}, float2{bezier[2], bezier[3]});
    auto animation = g.compositor.CreateScalarKeyFrameAnimation();
    animation.InsertKeyFrame(0.f, 0.f);
    animation.InsertKeyFrame(1.f, 1.f, easing);
    animation.Duration(std::chrono::milliseconds(static_cast<int64_t>(ms)));
    g.props.StartAnimation(L"P", animation);
  } catch (...) {
  }
  return Undefined(env);
}

napi_value JsSetTarget(napi_env env, napi_callback_info info) {
  napi_value argv[1];
  size_t argc;
  float to[4];
  if (!g.hwnd || !Args(env, info, argv, argc) || argc < 1 || !ReadRect(env, argv[0], to)) return Undefined(env);
  try {
    SetEdges(L"T", to);
  } catch (...) {
  }
  return Undefined(env);
}

napi_value JsPlaceOnWindowMonitor(napi_env env, napi_callback_info info) {
  napi_value argv[1];
  size_t argc;
  if (!g.hwnd || !Args(env, info, argv, argc) || argc < 1) return Undefined(env);
  HWND window = HwndFrom(env, argv[0]);
  if (!window) return Undefined(env);
  MONITORINFO mi{};
  mi.cbSize = sizeof(mi);
  if (!GetMonitorInfoW(MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST), &mi)) return Undefined(env);
  RECT const& r = mi.rcWork;
  ApplyArea(r.left, r.top, r.right - r.left, r.bottom - r.top);
  return NumberArray(env, {static_cast<double>(r.left), static_cast<double>(r.top),
                           static_cast<double>(r.right - r.left), static_cast<double>(r.bottom - r.top)});
}

napi_value JsBeginMorph(napi_env env, napi_callback_info info) {
  napi_value argv[3];
  size_t argc;
  if (!g.hwnd || !Args(env, info, argv, argc) || argc < 1) return Bool(env, false);
  float from[4];
  bool hasFrom = argc >= 2 && ReadRect(env, argv[1], from);
  double opacity = argc >= 3 ? ArgNumber(env, argv[2], 255) : 255;
  if (opacity < 0) opacity = 0;
  if (opacity > 255) opacity = 255;
  return Bool(env, BeginMorph(HwndFrom(env, argv[0]), hasFrom ? from : nullptr, static_cast<BYTE>(opacity)));
}

napi_value JsRunMorph(napi_env env, napi_callback_info info) {
  napi_value argv[7];
  size_t argc;
  float from[4], to[4], bezier[4] = {0.2f, 0.9f, 0.1f, 1.f};
  if (!g.hwnd || !Args(env, info, argv, argc) || argc < 3) return Undefined(env);
  if (!ReadRect(env, argv[0], from) || !ReadRect(env, argv[1], to)) {
    EndMorphNow();
    return Undefined(env);
  }
  if (argc >= 4) ReadRect(env, argv[3], bezier);
  bool autoReveal = true;
  if (argc >= 5) napi_get_value_bool(env, argv[4], &autoReveal);
  double opFrom = argc >= 6 ? ArgNumber(env, argv[5], 255) : 255;
  double opTo = argc >= 7 ? ArgNumber(env, argv[6], 255) : 255;
  RunMorph(from, to, ArgNumber(env, argv[2], 250), bezier, autoReveal, opFrom, opTo);
  return Undefined(env);
}

napi_value JsRevealMorph(napi_env env, napi_callback_info) {
  int token = g_morphToken.load();
  std::thread([token]() { RevealMorph(token); }).detach();
  return Undefined(env);
}

napi_value JsSetMorphTarget(napi_env env, napi_callback_info info) {
  napi_value argv[1];
  size_t argc;
  float to[4];
  if (!Args(env, info, argv, argc) || argc < 1 || !ReadRect(env, argv[0], to)) return Undefined(env);
  std::lock_guard<std::mutex> lock(g_morphLock);
  for (int i = 0; i < 4; ++i) g_morphTo[i] = to[i];
  return Undefined(env);
}

napi_value JsEndMorph(napi_env env, napi_callback_info) {
  ++g_morphToken;
  EndMorphNow();
  return Undefined(env);
}

napi_value JsCloak(napi_env env, napi_callback_info info) {
  napi_value argv[2];
  size_t argc;
  if (!Args(env, info, argv, argc) || argc < 2) return Undefined(env);
  bool on = false;
  napi_get_value_bool(env, argv[1], &on);
  Cloak(HwndFrom(env, argv[0]), on);
  return Undefined(env);
}

napi_value JsSetTransitionsDisabled(napi_env env, napi_callback_info info) {
  napi_value argv[2];
  size_t argc;
  if (!Args(env, info, argv, argc) || argc < 2) return Undefined(env);
  bool disabled = false;
  napi_get_value_bool(env, argv[1], &disabled);
  SetTransitionsDisabled(HwndFrom(env, argv[0]), disabled);
  return Undefined(env);
}

napi_value JsMinimizeKeepingPreview(napi_env env, napi_callback_info info) {
  napi_value argv[1];
  size_t argc;
  if (!Args(env, info, argv, argc) || argc < 1) return Undefined(env);
  MinimizeKeepingPreview(HwndFrom(env, argv[0]));
  return Undefined(env);
}

napi_value JsArmRestoreTrap(napi_env env, napi_callback_info info) {
  napi_value argv[2];
  size_t argc;
  if (!Args(env, info, argv, argc) || argc < 2) return Undefined(env);
  bool armed = false;
  napi_get_value_bool(env, argv[1], &armed);
  ArmRestoreTrap(HwndFrom(env, argv[0]), armed);
  return Undefined(env);
}

napi_value JsTakeRestoredCloaked(napi_env env, napi_callback_info) {
  return Bool(env, g_restoredCloaked.exchange(false));
}

napi_value JsTransform(napi_env env, napi_callback_info info) {
  napi_value argv[8];
  size_t argc;
  float from[4], to[4], bezier[4] = {0.2f, 0.f, 0.f, 1.f};
  if (!g.hwnd || !Args(env, info, argv, argc) || argc < 8) return Bool(env, false);
  if (!ReadRect(env, argv[0], from) || !ReadRect(env, argv[1], to)) return Bool(env, false);
  ReadRect(env, argv[3], bezier);
  return Bool(env, Transform(from, to, ArgNumber(env, argv[2], 420), bezier,
                             static_cast<float>(ArgNumber(env, argv[4], 0)), static_cast<float>(ArgNumber(env, argv[5], 0)),
                             HwndFrom(env, argv[6]), HwndFrom(env, argv[7])));
}

napi_value JsEndTransform(napi_env env, napi_callback_info) {
  ++g_xfToken;
  EndTransformNow();
  return Undefined(env);
}

napi_value JsDestroy(napi_env env, napi_callback_info) {
  ++g_xfToken;
  EndTransformNow();
  ++g_morphToken;
  EndMorphNow();
  Destroy();
  return Undefined(env);
}

napi_value ModuleInit(napi_env env, napi_value exports) {
  struct Fn {
    char const* name;
    napi_callback cb;
  };
  Fn fns[] = {
      {"init", JsInit},         {"hasBackdrop", JsHasBackdrop}, {"setArea", JsSetArea}, {"setStyle", JsSetStyle},
      {"placeOnCursorMonitor", JsPlaceOnCursorMonitor},         {"windowRect", JsWindowRect},
      {"placeOnWindowMonitor", JsPlaceOnWindowMonitor},         {"beginMorph", JsBeginMorph},
      {"runMorph", JsRunMorph},                                 {"endMorph", JsEndMorph},
      {"setMorphTarget", JsSetMorphTarget},                     {"revealMorph", JsRevealMorph},
      {"cloak", JsCloak},                                       {"transform", JsTransform},
      {"endTransform", JsEndTransform},                         {"lastError", JsLastError},
      {"show", JsShow},         {"hide", JsHide},               {"animate", JsAnimate}, {"setTarget", JsSetTarget},
      {"destroy", JsDestroy},   {"setTransitionsDisabled", JsSetTransitionsDisabled},
      {"minimizeKeepingPreview", JsMinimizeKeepingPreview},
      {"armRestoreTrap", JsArmRestoreTrap},                    {"takeRestoredCloaked", JsTakeRestoredCloaked},
  };
  for (auto const& fn : fns) {
    napi_value value;
    napi_create_function(env, fn.name, NAPI_AUTO_LENGTH, fn.cb, nullptr, &value);
    napi_set_named_property(env, exports, fn.name, value);
  }
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, ModuleInit)
