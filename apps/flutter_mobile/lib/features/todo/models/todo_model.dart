// ── TodoModel ────────────────────────────────────────────────────────────────
// Represents a single personal ToDo with optional links and shared user.

class TodoStatus {
  static const open       = 'open';
  static const inProgress = 'in_progress';
  static const waiting    = 'waiting';
  static const done       = 'done';

  static const all = [open, inProgress, waiting, done];

  static String label(String s) {
    switch (s) {
      case inProgress: return 'In Bearbeitung';
      case waiting:    return 'Wartend';
      case done:       return 'Erledigt';
      default:         return 'Offen';
    }
  }
}

class TodoEntityType {
  static const defect    = 'defect';
  static const task      = 'task';
  static const milestone = 'milestone';
  static const document  = 'document';
  static const object    = 'object';
  static const note      = 'note';
  static const message   = 'message';

  static String label(String t) {
    switch (t) {
      case task:      return 'Aufgabe';
      case milestone: return 'Meilenstein';
      case document:  return 'Dokument';
      case object:    return 'Objekt';
      case note:      return 'Notiz';
      case message:   return 'Nachricht';
      default:        return 'Mangel';
    }
  }
}

class TodoLink {
  final String id;
  final String todoId;
  final String entityType;
  final String entityId;
  final String projectId;
  final String? entityLabel; // populated client-side

  const TodoLink({
    required this.id,
    required this.todoId,
    required this.entityType,
    required this.entityId,
    required this.projectId,
    this.entityLabel,
  });

  factory TodoLink.fromJson(Map<String, dynamic> j) => TodoLink(
        id:          j['id'] as String,
        todoId:      j['todo_id'] as String,
        entityType:  j['entity_type'] as String,
        entityId:    j['entity_id'] as String,
        projectId:   j['project_id'] as String,
        entityLabel: j['entity_label'] as String?,
      );

  Map<String, dynamic> toInsert() => {
        'todo_id':     todoId,
        'entity_type': entityType,
        'entity_id':   entityId,
        'project_id':  projectId,
      };
}

class TodoModel {
  final String id;
  final String name;
  final String? description;  // HTML string
  final String status;
  final DateTime? dueDate;
  final String? location;
  final String ownerUserId;
  final String? sharedWithUserId;
  final String? sharedWithName;
  final String? sharedWithAvatar;
  final List<TodoLink> links;
  final DateTime createdAt;
  final DateTime updatedAt;

  const TodoModel({
    required this.id,
    required this.name,
    this.description,
    required this.status,
    this.dueDate,
    this.location,
    required this.ownerUserId,
    this.sharedWithUserId,
    this.sharedWithName,
    this.sharedWithAvatar,
    this.links = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isDone      => status == TodoStatus.done;
  bool get isOverdue   => dueDate != null && dueDate!.isBefore(DateTime.now()) && !isDone;
  bool get isShared    => sharedWithUserId != null;

  factory TodoModel.fromJson(Map<String, dynamic> j) {
    final linksJson = j['todo_links'] as List<dynamic>? ?? [];
    return TodoModel(
      id:                 j['id'] as String,
      name:               j['name'] as String,
      description:        j['description'] as String?,
      status:             j['status'] as String? ?? TodoStatus.open,
      dueDate:            j['due_date'] != null ? DateTime.parse(j['due_date'] as String) : null,
      location:           j['location'] as String?,
      ownerUserId:        j['owner_user_id'] as String,
      sharedWithUserId:   j['shared_with_user_id'] as String?,
      sharedWithName:     j['shared_profile'] != null
          ? '${j['shared_profile']['first_name'] ?? ''} ${j['shared_profile']['last_name'] ?? ''}'.trim()
          : null,
      sharedWithAvatar:   j['shared_profile']?['avatar_url'] as String?,
      links:              linksJson.map((l) => TodoLink.fromJson(l as Map<String, dynamic>)).toList(),
      createdAt:          DateTime.parse(j['created_at'] as String),
      updatedAt:          DateTime.parse(j['updated_at'] as String),
    );
  }

  TodoModel copyWith({
    String?  name,
    String?  description,
    String?  status,
    DateTime? dueDate,
    String?  location,
    String?  sharedWithUserId,
    String?  sharedWithName,
    String?  sharedWithAvatar,
    List<TodoLink>? links,
    bool clearDueDate = false,
    bool clearShared  = false,
  }) => TodoModel(
    id:                 id,
    name:               name               ?? this.name,
    description:        description        ?? this.description,
    status:             status             ?? this.status,
    dueDate:            clearDueDate ? null : (dueDate ?? this.dueDate),
    location:           location           ?? this.location,
    ownerUserId:        ownerUserId,
    sharedWithUserId:   clearShared ? null : (sharedWithUserId ?? this.sharedWithUserId),
    sharedWithName:     clearShared ? null : (sharedWithName   ?? this.sharedWithName),
    sharedWithAvatar:   clearShared ? null : (sharedWithAvatar ?? this.sharedWithAvatar),
    links:              links              ?? this.links,
    createdAt:          createdAt,
    updatedAt:          DateTime.now(),
  );
}

class ShareableUser {
  final String userId;
  final String displayName;
  final String? avatarUrl;

  const ShareableUser({
    required this.userId,
    required this.displayName,
    this.avatarUrl,
  });

  factory ShareableUser.fromJson(Map<String, dynamic> j) => ShareableUser(
        userId:      j['user_id'] as String,
        displayName: j['display_name'] as String? ?? '',
        avatarUrl:   j['avatar_url'] as String?,
      );

  String get initials {
    final parts = displayName.split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return displayName.isNotEmpty ? displayName[0].toUpperCase() : '?';
  }
}
