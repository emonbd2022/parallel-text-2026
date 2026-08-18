const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

const notifRulesTarget = `    // =========================================================
    // NOTIFICATIONS COLLECTION
    // Admin-targeted lightweight notifications (e.g. new signup alerts)
    // Enforced against schema allowlist for BOTH admins and new users.
    // =========================================================
    match /notifications/{notificationId} {
      // Read: Strictly restricted to administrators
      allow read: if isAdmin();

      // Create: Enforces schema allowlist and prohibits local data for BOTH admins and new users.
      // Newly registered users are constrained to creating ONLY their own deterministic signup alert.
      allow create: if isAuthenticated() &&
        hasOnlyNotificationFields() &&
        hasNoForbiddenLocalData() &&
        request.resource.data.targetUid == 'admin' &&
        request.resource.data.createdAt is string &&
        request.resource.data.read is bool &&
        (
          isAdmin() ||
          (
            notificationId == ('signup_' + request.auth.uid) &&
            request.resource.data.type == 'signup' &&
            request.resource.data.id == ('signup_' + request.auth.uid) &&
            request.resource.data.userName is string &&
            request.resource.data.userEmail is string &&
            request.resource.data.message is string &&
            request.resource.data.read == false
          )
        );`;

const notifRulesReplace = `    // =========================================================
    // NOTIFICATIONS COLLECTION
    // Two-way lightweight notifications (admin alerts & global user announcements)
    // Enforced against schema allowlist for BOTH admins and normal users.
    // =========================================================
    match /notifications/{notificationId} {
      // Read: Admins can read all. Users can read global notifications.
      allow read: if isAuthenticated() && (isAdmin() || resource.data.targetUid == 'all');

      // Create: Enforces schema allowlist and prohibits local data.
      // Admins can create. Newly registered users can ONLY create their own signup alert to admin.
      allow create: if isAuthenticated() &&
        hasOnlyNotificationFields() &&
        hasNoForbiddenLocalData() &&
        request.resource.data.createdAt is string &&
        request.resource.data.read is bool &&
        (
          (isAdmin() && request.resource.data.targetUid in ['admin', 'all']) ||
          (
            request.resource.data.targetUid == 'admin' &&
            notificationId == ('signup_' + request.auth.uid) &&
            request.resource.data.type == 'signup' &&
            request.resource.data.id == ('signup_' + request.auth.uid) &&
            request.resource.data.userName is string &&
            request.resource.data.userEmail is string &&
            request.resource.data.message is string &&
            request.resource.data.read == false
          )
        );`;

code = code.replace(notifRulesTarget, notifRulesReplace);
fs.writeFileSync('firestore.rules', code);
