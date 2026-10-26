{
  "targets": [
    {
      "target_name": "snap_preview",
      "conditions": [
        [
          "OS=='win'",
          {
            "sources": ["src/snap_preview.cc"],
            "libraries": ["windowsapp.lib", "dwmapi.lib", "user32.lib", "CoreMessaging.lib", "comctl32.lib"],
            "defines": ["UNICODE", "_UNICODE", "NOMINMAX", "WIN32_LEAN_AND_MEAN", "NAPI_VERSION=8", "_HAS_EXCEPTIONS=1"],
            "msvs_settings": {
              "VCCLCompilerTool": {
                "ExceptionHandling": 1,
                "AdditionalOptions": ["/std:c++20", "/EHsc", "/permissive-", "/bigobj", "/utf-8"]
              }
            }
          }
        ]
      ]
    }
  ]
}
