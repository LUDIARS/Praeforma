// @implements SPEC-PF-UNITY-EDITOR
// @spec PF-UNITY-EDITOR
using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace Ludiars.Praeforma.Editor
{
    // Captures the destination before asynchronous work; changing the UI cannot redirect a request.
    internal sealed class EditorWorkspaceApi
    {
        private readonly string endpoint;
        private readonly string token;
        public EditorWorkspaceApi()
        {
            var settings = EditorEndpoint.Capture();
            endpoint = settings.Url;
            token = settings.Token;
        }

        public Task<EditorSpecPage> Specifications(string projectId, int offset, CancellationToken cancel)
            => Send<EditorSpecPage>(Project(projectId) + "/specs?limit=50&offset=" + offset, null, cancel);
        public Task<EditorFragmentResponse> SaveInstruction(string projectId, EditorInstructionRequest request, CancellationToken cancel)
            => Send<EditorFragmentResponse>(Project(projectId) + "/spec-fragments", request, cancel);
        private static string Project(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) throw new InvalidOperationException("Select a Pf project first.");
            return "/api/projects/" + Uri.EscapeDataString(id);
        }

        private async Task<T> Send<T>(string path, object body, CancellationToken cancel)
        {
            cancel.ThrowIfCancellationRequested();
            using (var request = new UnityWebRequest(endpoint + path, body == null ? "GET" : "POST"))
            {
                request.timeout = 15;
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Accept", "application/json");
                if (!string.IsNullOrEmpty(token)) request.SetRequestHeader("Authorization", "Bearer " + token);
                if (body != null)
                {
                    request.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(JsonUtility.ToJson(body)));
                    request.SetRequestHeader("Content-Type", "application/json; charset=utf-8");
                }
                var completed = new TaskCompletionSource<bool>();
                var operation = request.SendWebRequest();
                using (cancel.Register(request.Abort))
                {
                    operation.completed += _ => completed.TrySetResult(true);
                    if (operation.isDone) completed.TrySetResult(true);
                    await completed.Task;
                }
                cancel.ThrowIfCancellationRequested();
                if (request.result != UnityWebRequest.Result.Success)
                    throw new InvalidOperationException("Pf HTTP " + request.responseCode + ": " + request.error);
                var result = JsonUtility.FromJson<T>(request.downloadHandler.text);
                if (result == null) throw new InvalidOperationException("Pf returned an empty response.");
                return result;
            }
        }
    }
}
