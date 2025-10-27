# Decision Record: Cloudflare Turnstile Selection

**Decision:** Adopt **Cloudflare Turnstile** as the human verification mechanism for ARETE web interactions.  
**Date:** 2025-10-27  
**Status:** Accepted  
**License Context:** MIT + HL3  

---

## 1. Context
ARETE’s public endpoints (e.g., API gateway, registration forms, demo interface) require protection against automated abuse.  
A human-verification mechanism is needed to prevent spam, brute-force attempts, and scripted probes while staying consistent with ARETE’s ethical commitments to transparency, user dignity, and privacy.

Candidate solutions evaluated:
- Google reCAPTCHA v2/v3  
- Cloudflare Turnstile  
- Self-hosted hCaptcha (declined on licensing grounds)

---

## 2. Decision
**Cloudflare Turnstile** will be implemented as the default verification mechanism for all public web interactions requiring human validation.  
Turnstile will operate primarily in *managed, non-interactive* mode, escalating to an interactive challenge only when confidence is low.

---

## 3. Rationale

| Criterion | reCAPTCHA | Turnstile | Ethical Commentary |
|------------|------------|------------|--------------------|
| **Privacy** | Collects behavioral telemetry, cookies, and identifiers | No tracking or profiling; anonymous attestation | Meets HL3 privacy expectations |
| **Transparency** | Closed heuristic models | Public technical overview, no user scoring | Easier to audit and document |
| **User Experience** | Frequent “image grid” puzzles | Invisible or minimal | Reduces cognitive friction; dignified interaction |
| **Self-hosting fit** | Requires Google scripts | Works with CDN or custom backend | Compatible with decentralized deployments |
| **Licensing** | Proprietary | Free under Cloudflare ToS | No conflict with MIT + HL3 dual license |

ARETE’s ethical stance prioritizes user autonomy and minimal data collection.  
Turnstile verifies *browser integrity* rather than *personal identity*, aligning with the project’s guiding principle: **verify function, not essence**.

---

## 4. Alternatives Considered
**reCAPTCHA:** Technically mature but inconsistent with transparency and privacy principles; conflicts with community self-hosting goals.  
**hCaptcha:** More privacy-aware than reCAPTCHA but monetizes user attention and carries commercial license restrictions incompatible with ARETE’s open philosophy.

---

## 5. Consequences
- Introduces a limited dependency on Cloudflare infrastructure, mitigated by modular design and future pluggable verification options.  
- Improves UX and accessibility for users.  
- Reduces telemetry exposure and simplifies compliance documentation.  
- Opens a future path toward an **ARETE-native attestation system** modeled on Turnstile’s privacy design.

---

## 6. Provenance
- **Discussion thread:** _TBD_ (link to GitHub issue or Discord discussion)  
- **Author(s):** Jordan
- **Approved by:** ethics-core maintainers  
- **Implementation PR:** _TBD_  

---