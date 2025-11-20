---
name: Feature Request
about: Suggest an idea or enhancement for Nucleus
title: "[FEATURE] "
labels: enhancement
assignees: ""
---

## 💡 Feature Description

A clear and concise description of the feature you'd like to see.

---

## 🎯 Problem Statement

What problem does this feature solve? Is your feature request related to a problem?

**Example:** "I'm always frustrated when [...]"

---

## 🚀 Proposed Solution

Describe the solution you'd like to see implemented.

**Example:**

- Add a new method `nucleus.queryByTimestamp()`
- Support PostgreSQL as a storage adapter
- Implement proof signature verification

---

## 🔄 Alternatives Considered

Describe any alternative solutions or features you've considered.

**Example:**

- Could use external indexing instead
- Could implement as a separate package
- Could modify existing API instead

---

## 📊 Use Case

Describe your specific use case for this feature.

**Example:**

```typescript
// How you would use this feature
const records = await nucleus.queryByTimestamp({
  start: "2025-01-01T00:00:00Z",
  end: "2025-12-31T23:59:59Z",
});
```

---

## 🎨 API Design (Optional)

If you have ideas about the API design, share them here.

```typescript
interface MyProposedInterface {
  // Your interface design
}
```

---

## 📚 Additional Context

Add any other context, mockups, or examples about the feature request here.

- Screenshots or diagrams
- Links to similar implementations
- Performance considerations
- Breaking change implications

---

## ✅ Acceptance Criteria

What would make this feature "done"? List specific requirements:

- [ ] Feature is implemented with tests
- [ ] Documentation is updated
- [ ] Examples are provided
- [ ] No breaking changes (or migration guide provided)

---

## 🤝 Willingness to Contribute

Would you be willing to contribute this feature?

- [ ] Yes, I can implement this
- [ ] Yes, with guidance
- [ ] No, but I can help with testing
- [ ] No, I'm just suggesting

---

## 🔗 Related Issues / PRs

Link to any related issues or pull requests:

- Related to #...
- Depends on #...
- Blocks #...
