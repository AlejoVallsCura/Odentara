async function logDeleteAudit(prisma, userId, entityType, entityId, beforeData) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        entityType,
        entityId: String(entityId),
        action: "delete",
        beforeData,
        afterData: { archived: true },
      },
    });
  } catch (_error) {
    // Audit logging should not block the main operation.
  }
}

module.exports = {
  logDeleteAudit,
};
