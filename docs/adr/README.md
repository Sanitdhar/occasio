# Architecture decision records

The [decision ledger](../decisions.md) records _what_ was decided. These records explain _why_,
for the decisions where the reasoning is not obvious from the outcome — and, more usefully, what
the alternative was and what it would have cost.

| ADR                                             | Decision                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| [0001](0001-one-expo-app-in-a-monorepo.md)      | One Expo app in a monorepo, not Flutter and not two front ends        |
| [0002](0002-tenant-config-drives-everything.md) | Tenant config is data that drives look and behaviour                  |
| [0003](0003-path-based-tenancy.md)              | Path-based tenancy is canonical; custom domains are a hosting concern |
| [0004](0004-adapter-boundary.md)                | Backend independence enforced by lint and proven by contract tests    |
| [0005](0005-no-workflow-engine.md)              | An outbox table instead of a workflow engine                          |
| [0006](0006-anonymous-identity-model.md)        | Anonymous to humans, device-tracked underneath                        |
| [0007](0007-google-only-sign-in.md)             | One sign-in provider, and what it will cost                           |
