// Praeforma layout_object に対応する placeholder GameObject。
// scene 上に置かれて Editor / Runtime で表示される。

using UnityEngine;

namespace Ludiars.Praeforma
{
    [ExecuteAlways]
    [AddComponentMenu("Praeforma/Placeholder Object")]
    public class PraeformaPlaceholder : MonoBehaviour
    {
        [Tooltip("Praeforma backend の layout_objects.id")]
        public string layoutObjectId;

        [Tooltip("対応する objects.id")]
        public string objectId;

        [Tooltip("対応する domains.id")]
        public string domainId;

        [Tooltip("backend の labels[].label。 hierarchy 表示用")]
        public string label;

        [Tooltip("placeholder shape (cube / sphere / plane / cylinder / sprite / image)")]
        public string placeholderShape = "cube";

        [Tooltip("placeholder color (#RRGGBB)")]
        public string placeholderColor = "#888888";

#if UNITY_EDITOR
        private void OnDrawGizmos()
        {
            Gizmos.color = ParseColor(placeholderColor);
            switch (placeholderShape)
            {
                case "sphere":
                    Gizmos.DrawWireSphere(transform.position, 0.5f * MaxScale());
                    break;
                case "cylinder":
                    Gizmos.DrawWireCube(transform.position, transform.lossyScale);
                    break;
                case "plane":
                    var s = transform.lossyScale;
                    Gizmos.DrawWireCube(transform.position, new Vector3(s.x, 0.05f, s.z));
                    break;
                default:
                    Gizmos.DrawWireCube(transform.position, transform.lossyScale);
                    break;
            }
        }

        private float MaxScale()
        {
            var s = transform.lossyScale;
            return Mathf.Max(Mathf.Abs(s.x), Mathf.Abs(s.y), Mathf.Abs(s.z));
        }

        private static Color ParseColor(string hex)
        {
            if (string.IsNullOrEmpty(hex)) return Color.gray;
            if (ColorUtility.TryParseHtmlString(hex, out var c)) return c;
            return Color.gray;
        }
#endif
    }
}
