// UnityWebRequest ベースの Praeforma backend クライアント。
// 全リクエストに Authorization: Bearer <PASETO> を付ける。
//
// EditorWindow から呼ぶ前提なので、 同期完了は EditorCoroutine ではなく
// async/await + Task<TaskCompletionSource> 経由。 UnityWebRequest は
// SendWebRequest().completed で callback できる。

using System;
using System.Text;
using System.Threading.Tasks;
using Ludiars.Praeforma.Models;
using UnityEngine;
using UnityEngine.Networking;

namespace Ludiars.Praeforma.Editor
{
    internal static class PraeformaApi
    {
        public class ApiException : Exception
        {
            public long Status { get; }
            public string ResponseBody { get; }
            public ApiException(long status, string body, string message) : base(message)
            {
                Status = status;
                ResponseBody = body;
            }
        }

        private static string BaseUrl => AuthStorage.BaseUrl.TrimEnd('/');

        // ── projects ────────────────────────────────────────────────────────

        public static Task<ProjectListResponse> ListProjects()
            => GetJson<ProjectListResponse>("/api/projects");

        // ── references ──────────────────────────────────────────────────────

        public static Task<ReferenceListResponse> ListReferences(
            string projectId, string targetKind, string targetId)
        {
            var url = $"/api/projects/{Uri.EscapeDataString(projectId)}/references"
                      + $"?target_kind={Uri.EscapeDataString(targetKind)}"
                      + $"&target_id={Uri.EscapeDataString(targetId)}";
            return GetJson<ReferenceListResponse>(url);
        }

        public static Task<SingleWrapper<ReferenceDto>> CreateReference(
            string projectId, ReferenceCreateRequest body)
        {
            var url = $"/api/projects/{Uri.EscapeDataString(projectId)}/references";
            return PostJson<SingleWrapper<ReferenceDto>>(url, body);
        }

        public static Task<string> DeleteReference(string projectId, string referenceId)
        {
            var url = $"/api/projects/{Uri.EscapeDataString(projectId)}/references/{Uri.EscapeDataString(referenceId)}";
            return DeleteRaw(url);
        }

        // ── feedback ────────────────────────────────────────────────────────

        public static Task<FeedbackListResponse> ListFeedback(
            string projectId, string layoutId = null, string objectId = null,
            string layoutObjectId = null, string state = null,
            int limit = 50, int offset = 0)
        {
            var sb = new StringBuilder();
            sb.Append($"/api/projects/{Uri.EscapeDataString(projectId)}/feedback");
            sb.Append($"?limit={limit}&offset={offset}");
            if (!string.IsNullOrEmpty(layoutId)) sb.Append($"&layout={Uri.EscapeDataString(layoutId)}");
            if (!string.IsNullOrEmpty(objectId)) sb.Append($"&object={Uri.EscapeDataString(objectId)}");
            if (!string.IsNullOrEmpty(layoutObjectId)) sb.Append($"&layout_object={Uri.EscapeDataString(layoutObjectId)}");
            if (!string.IsNullOrEmpty(state)) sb.Append($"&state={Uri.EscapeDataString(state)}");
            return GetJson<FeedbackListResponse>(sb.ToString());
        }

        public static Task<FeedbackDetailResponse> GetFeedback(string projectId, string feedbackId)
        {
            var url = $"/api/projects/{Uri.EscapeDataString(projectId)}/feedback/{Uri.EscapeDataString(feedbackId)}";
            return GetJson<FeedbackDetailResponse>(url);
        }

        public static Task<SingleWrapper<FeedbackDto>> CreateFeedback(
            string projectId, FeedbackCreateRequest body)
        {
            var url = $"/api/projects/{Uri.EscapeDataString(projectId)}/feedback";
            return PostJson<SingleWrapper<FeedbackDto>>(url, body);
        }

        // ── transport ───────────────────────────────────────────────────────

        private static Task<T> GetJson<T>(string path) => Send<T>(path, UnityWebRequest.kHttpVerbGET, null);
        private static Task<T> PostJson<T>(string path, object body) => Send<T>(path, UnityWebRequest.kHttpVerbPOST, body);
        private static Task<string> DeleteRaw(string path) => SendRaw(path, UnityWebRequest.kHttpVerbDELETE, null);

        private static Task<T> Send<T>(string path, string method, object body)
        {
            var tcs = new TaskCompletionSource<T>();
            var url = BaseUrl + path;
            var req = new UnityWebRequest(url, method);
            req.downloadHandler = new DownloadHandlerBuffer();
            if (body != null)
            {
                var json = JsonUtility.ToJson(body);
                var bytes = Encoding.UTF8.GetBytes(json);
                req.uploadHandler = new UploadHandlerRaw(bytes);
                req.SetRequestHeader("Content-Type", "application/json");
            }
            req.SetRequestHeader("Accept", "application/json");
            if (!string.IsNullOrEmpty(AuthStorage.Token))
                req.SetRequestHeader("Authorization", "Bearer " + AuthStorage.Token);

            var op = req.SendWebRequest();
            op.completed += _ =>
            {
                try
                {
                    var status = req.responseCode;
                    var text = req.downloadHandler != null ? req.downloadHandler.text : null;
                    if (req.result != UnityWebRequest.Result.Success)
                    {
                        tcs.SetException(new ApiException(status, text, $"HTTP {status} {req.error}"));
                        return;
                    }
                    var parsed = string.IsNullOrEmpty(text) ? default : JsonUtility.FromJson<T>(text);
                    tcs.SetResult(parsed);
                }
                catch (Exception e)
                {
                    tcs.SetException(e);
                }
                finally
                {
                    req.Dispose();
                }
            };
            return tcs.Task;
        }

        private static Task<string> SendRaw(string path, string method, object body)
        {
            var tcs = new TaskCompletionSource<string>();
            var url = BaseUrl + path;
            var req = new UnityWebRequest(url, method);
            req.downloadHandler = new DownloadHandlerBuffer();
            if (body != null)
            {
                var json = JsonUtility.ToJson(body);
                var bytes = Encoding.UTF8.GetBytes(json);
                req.uploadHandler = new UploadHandlerRaw(bytes);
                req.SetRequestHeader("Content-Type", "application/json");
            }
            if (!string.IsNullOrEmpty(AuthStorage.Token))
                req.SetRequestHeader("Authorization", "Bearer " + AuthStorage.Token);
            var op = req.SendWebRequest();
            op.completed += _ =>
            {
                try
                {
                    var status = req.responseCode;
                    var text = req.downloadHandler != null ? req.downloadHandler.text : null;
                    if (req.result != UnityWebRequest.Result.Success)
                    {
                        tcs.SetException(new ApiException(status, text, $"HTTP {status} {req.error}"));
                        return;
                    }
                    tcs.SetResult(text);
                }
                catch (Exception e)
                {
                    tcs.SetException(e);
                }
                finally
                {
                    req.Dispose();
                }
            };
            return tcs.Task;
        }
    }
}
