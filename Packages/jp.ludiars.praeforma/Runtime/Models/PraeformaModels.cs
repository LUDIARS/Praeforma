// Praeforma backend が返す JSON に対応する DTO。
// UnityEngine.JsonUtility 互換のため、 全フィールドは public、 enum は string で受ける。

using System;
using System.Collections.Generic;

namespace Ludiars.Praeforma.Models
{
    [Serializable]
    public class ProjectDto
    {
        public string id;
        public string name;
        public string description;
        public string org_id;
        public string owner_user_id;
        public string[] platforms;
        public string default_layout_id;
        public string created_at;
        public string updated_at;
    }

    [Serializable]
    public class ProjectListResponse
    {
        public ProjectDto[] items;
    }

    [Serializable]
    public class DomainDto
    {
        public string id;
        public string project_id;
        public string name;
        public string description;
        public string color;
        public string icon;
        public string parent_id;
        public int? max_count;
    }

    [Serializable]
    public class ObjectDto
    {
        public string id;
        public string project_id;
        public string domain_id;
        public string label;
        public string placeholder_shape;
        public string placeholder_color;
        public string parent_object_id;
    }

    [Serializable]
    public class LayoutDto
    {
        public string id;
        public string project_id;
        public string name;
        public string description;
        public string kind;
        public bool is_default;
    }

    [Serializable]
    public class LayoutObjectDto
    {
        public string id;
        public string layout_id;
        public string object_id;
        public float[] position;   // [x, y, z]
        public float[] rotation;
        public float[] scale;
        public string parent_layout_object_id;
        public bool lock_transform;
        public int ordinal;
    }

    [Serializable]
    public class ReferenceDto
    {
        public string id;
        public string project_id;
        public string target_kind;
        public string target_id;
        public string kind;        // notion / confluence / google-docs / web / figma / github
        public string url;
        public string title;
        public string description;
        public string display_mode; // link / webview / markdown
        public int ordinal;
    }

    [Serializable]
    public class ReferenceListResponse
    {
        public ReferenceDto[] items;
    }

    [Serializable]
    public class FeedbackDto
    {
        public string id;
        public string project_id;
        public string layout_id;
        public string object_id;
        public string layout_object_id;
        public string scene_path;
        public float[] world_position;   // [x, y, z]
        public float[] screen_position;  // [x, y]
        public string title;
        public string body;
        public string priority;          // low / medium / high / critical
        public string category;          // bug / feature / improvement / question / spec-clarification
        public string state;             // open / in-progress / resolved / wont-fix
        public string[] labels;
        public string assignee_user_id;
        public string github_issue_number;
        public string created_by;
        public string created_at;
        public string updated_at;
        public string resolved_at;
    }

    [Serializable]
    public class FeedbackListResponse
    {
        public FeedbackDto[] items;
        public int limit;
        public int offset;
    }

    [Serializable]
    public class FeedbackCommentDto
    {
        public string id;
        public string feedback_id;
        public string user_id;
        public string display_name;
        public string body;
        public string created_at;
    }

    [Serializable]
    public class FeedbackDetailResponse
    {
        public FeedbackDto feedback;
        public FeedbackCommentDto[] comments;
    }

    [Serializable]
    public class FeedbackCreateRequest
    {
        public string layout_id;
        public string object_id;
        public string layout_object_id;
        public string scene_path;
        public float[] world_position;
        public float[] screen_position;
        public string title;
        public string body;
        public string priority;
        public string category;
        public string[] labels;
    }

    [Serializable]
    public class ReferenceCreateRequest
    {
        public string target_kind;
        public string target_id;
        public string url;
        public string title;
        public string description;
        public string kind;
        public string display_mode;
        public int ordinal;
    }

    /// <summary>Generic wrapper for { "...": { ... } } single-object responses.</summary>
    [Serializable]
    public class SingleWrapper<T>
    {
        public T feedback;
        public T reference;
        public T comment;
    }
}
