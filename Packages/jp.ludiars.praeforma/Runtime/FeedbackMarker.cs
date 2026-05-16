// Melpomene 互換のシーン FB マーカー。 Praeforma backend の object_feedback 1 行に対応。
// Scene view 上に gizmo (球体 + 旗) を立てて、 placeholder に紐付けて表示する。

using UnityEngine;

namespace Ludiars.Praeforma
{
    [ExecuteAlways]
    [AddComponentMenu("Praeforma/Feedback Marker")]
    public class FeedbackMarker : MonoBehaviour
    {
        [Tooltip("Praeforma backend の object_feedback.id")]
        public string feedbackId;

        [Tooltip("対応する layout_objects.id (= placement)")]
        public string layoutObjectId;

        [Tooltip("対応する objects.id")]
        public string objectId;

        [Tooltip("対応する layout_id (= scene)")]
        public string layoutId;

        [Tooltip("FB タイトル (= 一覧表示用)")]
        public string title;

        [Tooltip("FB 本文 (Markdown)")]
        [TextArea(3, 10)]
        public string body;

        [Tooltip("low / medium / high / critical")]
        public string priority = "medium";

        [Tooltip("bug / feature / improvement / question / spec-clarification")]
        public string category = "question";

        [Tooltip("open / in-progress / resolved / wont-fix")]
        public string state = "open";

#if UNITY_EDITOR
        private static readonly Color OpenColor = new Color(0.95f, 0.78f, 0.10f);
        private static readonly Color InProgressColor = new Color(0.30f, 0.55f, 0.90f);
        private static readonly Color ResolvedColor = new Color(0.27f, 0.78f, 0.45f);
        private static readonly Color WontFixColor = new Color(0.55f, 0.55f, 0.55f);
        private static readonly Color CriticalRing = new Color(0.86f, 0.20f, 0.20f);

        private void OnDrawGizmos()
        {
            var p = transform.position;
            var c = StateColor(state);

            // 球体ピン
            Gizmos.color = c;
            Gizmos.DrawSphere(p, 0.12f);
            Gizmos.color = Color.black;
            Gizmos.DrawWireSphere(p, 0.12f);

            // critical は赤いリングを足す
            if (priority == "critical")
            {
                Gizmos.color = CriticalRing;
                Gizmos.DrawWireSphere(p, 0.2f);
            }

            // 縦旗 (= Melpomene の旗イメージ)
            Gizmos.color = c;
            Gizmos.DrawLine(p, p + Vector3.up * 0.6f);
            Gizmos.DrawCube(p + Vector3.up * 0.5f + Vector3.right * 0.18f, new Vector3(0.36f, 0.18f, 0.02f));
        }

        private static Color StateColor(string s)
        {
            switch (s)
            {
                case "in-progress": return InProgressColor;
                case "resolved":    return ResolvedColor;
                case "wont-fix":    return WontFixColor;
                default:            return OpenColor;
            }
        }
#endif
    }
}
