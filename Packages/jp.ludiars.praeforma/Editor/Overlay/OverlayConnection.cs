// @implements SPEC-PF-UNITY-EDITOR
// @spec PF-UNITY-EDITOR
namespace Ludiars.Praeforma.Editor
{
    // Optional adapters register here. The core package does not reference Tela.
    public interface IOverlayConnection
    {
        string Status { get; }
        void Connect(string localPipe);
        void Disconnect();
    }

    public static class OverlayConnection
    {
        public static IOverlayConnection Provider { get; set; }
    }
}
