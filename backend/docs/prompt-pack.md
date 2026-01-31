# EvoBook Prompt Pack (Hardcoded, Single Folder)

Prompts are stored under:
- `app/prompts/*.txt`

No prompt_version is used. Backend records:
- prompt_name (filename)
- prompt_hash = sha256(content)

---

## 1) Prompt List
- onboarding.txt
- dag.txt
- knowledge_card.txt
- clarification.txt
- qa_detail.txt
- quiz.txt

---

## 2) DSL for Knowledge Card Parsing

### 2.1 XML Page Break
Use EXACT tag:
`<EVOBK_PAGE_BREAK />`

- Markdown must be split into pages using the page break tag.
- Each page must start with an H2 title line:
  `## <Page Title>`
- H2 must be used ONLY for page titles (no other H2 in body).

### 2.2 Key Structural Elements Box (parseable)
Use EXACT block:
```xml
<EVOBK_KEY_ELEMENTS title="Key Structural Elements">
  <EVOBK_KEY title="...">...</EVOBK_KEY>
  <EVOBK_KEY title="...">...</EVOBK_KEY>
  <EVOBK_KEY title="...">...</EVOBK_KEY>
</EVOBK_KEY_ELEMENTS>
```

### 2.3 Expert Tip Box (parseable)
```xml
<EVOBK_EXPERT_TIP title="Expert Tip">
...content...
</EVOBK_EXPERT_TIP>
```

---

## 3) Knowledge Card Output Requirements

Response JSON:
```json
{
  "type": "knowledge_card",
  "node_id": 1,
  "totalPagesInCard": 2,
  "markdown": "string",
  "yaml": "string"
}
```

YAML must mirror (only):
- type
- node_id
- totalPagesInCard

---

## 4) Clarification Output Requirements
```json
{
  "type": "clarification",
  "corrected_title": "string",
  "short_answer": "string"
}
```

---

## 5) QA Detail Output Requirements
```json
{
  "type": "qa_detail",
  "title": "string",
  "body_markdown": "string",
  "image": {
    "placeholder": "string",
    "prompt": "string"
  }
}
```

---

## 6) Quiz Output Requirements
```json
{
  "type": "quiz",
  "title": "string",
  "greeting": {
    "topics_included": ["string"],
    "message": "string"
  },
  "questions": [
    {
      "qtype": "single|multi|boolean",
      "prompt": "string",
      "options": ["A","B","C","D"],
      "answer": "string"
    }
  ]
}
```
