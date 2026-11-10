# Entity Relationship Overview

## Identity

```
User ──< UserRole >── Role ──< RolePermission >── Permission
User ──< RefreshToken
User ──< Device ──< BrowserFingerprint
User ── TwoFactorSecret
User ── Candidate
Department ──< User
```

## Question Bank

```
QuestionBank ──< Question ──< QuestionVersion ──< Choice
Question ── Topic
Question ──< QuestionTag >── Tag
QuestionVersion ──< ApprovalWorkflow
Question ──< MediaAsset
```

## Exams & Attempts

```
ExamTemplate ──< ExamSection
ExamTemplate ──< ExamQuestionRule
ExamTemplate ──< ExamSession ──< ExamInvitation
ExamSession ──< ExamAttempt ──< AttemptAnswer
ExamAttempt ── Result ── Certificate
ExamAttempt ── ProctorSession ──< ProctorEvent
```

## Billing & Comms

```
User ──< Invoice ──< InvoiceLine >── Product
User ──< Payment
User ──< Notification
Webhook ──< WebhookDelivery
```

See Prisma schema at `packages/database/prisma/schema.prisma` for full field-level detail and indexes.
