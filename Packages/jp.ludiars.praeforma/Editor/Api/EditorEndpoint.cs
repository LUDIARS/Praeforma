// @implements SPEC-PF-UNITY-EDITOR
// @spec PF-UNITY-EDITOR
using System;

namespace Ludiars.Praeforma.Editor
{
    internal sealed class EditorEndpoint
    {
        public string Url { get; }
        public string Token { get; }
        public EditorEndpoint(string url, string token, bool local)
        {
            Url = (url ?? "").TrimEnd('/');
            if (!Uri.TryCreate(Url, UriKind.Absolute, out var uri) ||
                (uri.Scheme != "http" && uri.Scheme != "https") || !string.IsNullOrEmpty(uri.UserInfo) ||
                !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment))
                throw new InvalidOperationException("Set a valid HTTP(S) backend URL in Login.");
            if (local && !uri.IsLoopback) throw new InvalidOperationException("Local mode requires a loopback backend.");
            if (!local && string.IsNullOrWhiteSpace(token))
                throw new InvalidOperationException("Set a token or explicitly choose local mode.");
            Token = local ? "" : token;
        }
        public static EditorEndpoint Capture() => new EditorEndpoint(AuthStorage.BaseUrl, AuthStorage.Token, AuthStorage.LocalMode);
    }
}
