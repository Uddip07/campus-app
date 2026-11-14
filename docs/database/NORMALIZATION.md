# CampusConnect — Database Normalization & Decomposition Analysis

## 1. Theoretical Foundations

Database normalization is the formal technique of organizing a relational schema to minimize data redundancy, eliminate update anomalies (insertion, deletion, and modification anomalies), and preserve data integrity through functional dependency analysis.

### 1.1 Formal Definitions of Normal Forms

1. **First Normal Form (1NF):**
   A relation schema $R$ is in 1NF if and only if:
   - All underlying attribute domains contain only atomic (indivisible) values.
   - There are no repeating groups, arrays, or nested relation structures.

2. **Second Normal Form (2NF):**
   A relation schema $R$ is in 2NF if and only if:
   - $R$ is in 1NF.
   - Every non-prime attribute $A \in R$ is **fully functionally dependent** on every candidate key of $R$.
   - Formally: There exists no proper subset $X \subset K$ of any candidate key $K$ such that $X \to A$ for any non-prime attribute $A$. (No partial dependencies).

3. **Third Normal Form (3NF):**
   A relation schema $R$ is in 3NF if and only if:
   - $R$ is in 2NF.
   - For every non-trivial functional dependency $X \to A \in F^+$:
     - Either $X$ is a **Superkey** of $R$, OR
     - $A$ is a **Prime Attribute** of $R$ (i.e., $A$ is part of some candidate key).
   - Formally: No non-prime attribute is transitively dependent on any candidate key.

4. **Boyce-Codd Normal Form (BCNF):**
   A relation schema $R$ is in BCNF if and only if:
   - For every non-trivial functional dependency $X \to A \in F^+$:
     - $X$ is a **Superkey** of $R$.
   - *Note:* BCNF is strictly stronger than 3NF. While all BCNF schemas are in 3NF, the converse is not always true.

---

## 2. Normalization Analysis by Relation

### 2.1 `COHORTS`
- **Schema:** $\text{COHORTS}(\text{id}, \text{graduationYear}, \text{createdAt}, \text{updatedAt})$
- **Candidate Keys:** $CK_1 = \{\text{id}\}, CK_2 = \{\text{graduationYear}\}$
- **Prime Attributes:** $\{\text{id}, \text{graduationYear}\}$
- **Non-Prime Attributes:** $\{\text{createdAt}, \text{updatedAt}\}$
- **Evaluation:**
  - **1NF:** Satisfied. All attributes contain scalar values.
  - **2NF:** Candidate keys are singletons ($\{\text{id}\}$, $\{\text{graduationYear}\}$). A singleton key has no proper non-empty subsets. Hence, partial dependency is mathematically impossible. Satisfies 2NF.
  - **3NF & BCNF:** The only non-trivial FDs are:
    1. $\text{id} \to \{\text{graduationYear}, \text{createdAt}, \text{updatedAt}\}$ (Determinant $\{\text{id}\}$ is a superkey).
    2. $\text{graduationYear} \to \{\text{id}, \text{createdAt}, \text{updatedAt}\}$ (Determinant $\{\text{graduationYear}\}$ is a superkey).
- **Highest Normal Form:** **BCNF**.

---

### 2.2 `USERS`
- **Schema:** $\text{USERS}(\text{id}, \text{authId}, \text{collegeId}, \text{collegeEmail}, \text{enrollmentYear}, \text{programCode}, \text{rollNumber}, \text{cohortId}, \text{role}, \text{status}, \text{createdAt}, \text{updatedAt})$
- **Candidate Keys:**
  - $CK_1 = \{\text{id}\}$
  - $CK_2 = \{\text{collegeId}\}$
  - $CK_3 = \{\text{collegeEmail}\}$
  - $CK_4 = \{\text{enrollmentYear}, \text{programCode}, \text{rollNumber}\}$
- **Prime Attributes:** $\{\text{id}, \text{collegeId}, \text{collegeEmail}, \text{enrollmentYear}, \text{programCode}, \text{rollNumber}\}$
- **Non-Prime Attributes:** $\{\text{authId}, \text{cohortId}, \text{role}, \text{status}, \text{createdAt}, \text{updatedAt}\}$
- **Evaluation:**
  - **1NF:** Satisfied.
  - **2NF:** Consider composite candidate key $CK_4 = \{\text{enrollmentYear}, \text{programCode}, \text{rollNumber}\}$.
    Does any proper subset determine a non-prime attribute?
    - $\{\text{enrollmentYear}\} \not\to \text{role}, \text{status}$ (Multiple students enroll in the same year).
    - $\{\text{programCode}\} \not\to \text{role}, \text{status}$ (Multiple students study the same program).
    - $\{\text{rollNumber}\} \not\to \text{role}, \text{status}$ (Roll numbers repeat across branches).
    No partial dependencies exist. Satisfies 2NF.
  - **3NF & BCNF Analysis:**
    Consider $FD_4: \text{collegeId} \to \{\text{enrollmentYear}, \text{programCode}, \text{rollNumber}\}$.
    Since $\text{collegeId}$ is a candidate key (superkey), this dependency satisfies BCNF.
    Consider $FD_5: \{\text{enrollmentYear}, \text{programCode}, \text{rollNumber}\} \to \text{collegeId}$.
    Determinant is a candidate key. Satisfies BCNF.
    All non-prime attributes $(\text{cohortId}, \text{role}, \text{status}, \text{createdAt}, \text{updatedAt})$ depend directly on the primary key without transitive dependencies between non-prime attributes.
- **Highest Normal Form:** **BCNF**.

---

### 2.3 `ROOMS` (Detailed 3NF vs BCNF Discussion)
- **Schema:** $\text{ROOMS}(\text{id}, \text{type}, \text{name}, \text{cohortId}, \text{createdAt}, \text{updatedAt})$
- **Candidate Key:** $CK_1 = \{\text{id}\}$
- **Dependencies:**
  1. $\text{id} \to \{\text{type}, \text{name}, \text{cohortId}, \text{createdAt}, \text{updatedAt}\}$
  2. For cohort rooms: $\{\text{type}, \text{cohortId}\} \to \{\text{name}\}$ where $\text{type} = \text{'cohort'}$.
- **Evaluation:**
  - For global and alumni rooms, $\text{cohortId}$ is `NULL`.
  - In standard relational database theory, $\{\text{type}, \text{cohortId}\}$ cannot serve as a global candidate key for the entire relation because `cohortId` allows null values for non-cohort rooms.
  - Under FD: $\{\text{type}, \text{cohortId}\} \to \text{name}$, the determinant $\{\text{type}, \text{cohortId}\}$ is **not** a superkey for the entire relation.
  - Furthermore, $\text{name}$ is a non-prime attribute.
  - Therefore, the single relation `ROOMS` strictly violates BCNF and sits at **3NF**.
- **Decomposition Alternative for Strict BCNF:**
  To achieve strict BCNF, `ROOMS` can be decomposed into:
  - $R_1(\underline{\text{id}}, \text{type}, \text{name}, \text{createdAt}, \text{updatedAt})$ for global/alumni system rooms.
  - $R_2(\underline{\text{id}}, \underline{\text{cohortId}}, \text{name})$ for cohort-specific rooms where $\{\text{cohortId}\} \to \text{name}$.
  *Engineering Justification for 3NF Conserved Relation:*
  In application design, maintaining a unified `ROOMS` collection prevents polymorphic join queries across chat room routing. Hence, `ROOMS` is preserved in **3NF**.

---

### 2.4 `MESSAGES`
- **Schema:** $\text{MESSAGES}(\text{id}, \text{roomId}, \text{senderId}, \text{content}, \text{replyToId}, \text{moderationStatus}, \text{deletedAt}, \text{editedAt}, \text{createdAt}, \text{updatedAt})$
- **Candidate Key:** $CK_1 = \{\text{id}\}$
- **Dependencies:** $\text{id} \to U \setminus \{\text{id}\}$.
- **Evaluation:**
  - Candidate key is a singleton; no partial dependencies.
  - Determinant of every dependency is the superkey $\{\text{id}\}$.
- **Highest Normal Form:** **BCNF**.

---

### 2.5 `MESSAGE_REACTIONS`
- **Schema:** $\text{MESSAGE\_REACTIONS}(\text{id}, \text{messageId}, \text{userId}, \text{reaction}, \text{createdAt})$
- **Candidate Keys:** $CK_1 = \{\text{id}\}, CK_2 = \{\text{messageId}, \text{userId}, \text{reaction}\}$
- **Evaluation:**
  - Every non-trivial FD has a candidate key as its determinant.
- **Highest Normal Form:** **BCNF**.

---

### 2.6 `REPORTS`
- **Schema:** $\text{REPORTS}(\text{id}, \text{messageId}, \text{reporterId}, \text{reason}, \text{description}, \text{status}, \text{reviewedBy}, \text{resolvedAt}, \text{createdAt}, \text{updatedAt})$
- **Candidate Keys:** $CK_1 = \{\text{id}\}, CK_2 = \{\text{messageId}, \text{reporterId}\}$
- **Evaluation:**
  - Both candidate keys are superkeys and satisfy all FDs without transitive dependencies.
- **Highest Normal Form:** **BCNF**.

---

### 2.7 `ANNOUNCEMENTS`
- **Schema:** $\text{ANNOUNCEMENTS}(\text{id}, \text{title}, \text{content}, \text{authorId}, \text{audienceType}, \text{cohortId}, \text{isPinned}, \text{publishedAt}, \text{expiresAt}, \text{createdAt}, \text{updatedAt})$
- **Candidate Key:** $CK_1 = \{\text{id}\}$
- **Evaluation:**
  - Similar to `ROOMS`, $\text{cohortId}$ is conditionally present only when $\text{audienceType} = \text{'cohort'}$.
  - The primary key $\text{id}$ uniquely determines all attributes.
  - Highest normal form is **BCNF** (or **3NF** if conditional audience dependencies are treated as partial constraints).

---

### 2.8 Summary of Schema Normal Forms

| Relation | Primary Key | Candidate Keys | 1NF | 2NF | 3NF | BCNF | Highest Normal Form | Reason / Notes |
|---|---|---|---|---|---|---|---|---|
| `COHORTS` | `id` | `{id}`, `{graduationYear}` | Yes | Yes | Yes | **Yes** | **BCNF** | All determinants are candidate keys. |
| `USERS` | `id` | `{id}`, `{collegeId}`, `{collegeEmail}`, `{enrollmentYear, programCode, rollNumber}` | Yes | Yes | Yes | **Yes** | **BCNF** | No partial or transitive dependencies; all determinants are superkeys. |
| `ANONYMOUS_IDENTITIES` | `id` | `{id}`, `{displayName}` | Yes | Yes | Yes | **Yes** | **BCNF** | All determinants are candidate keys. |
| `ROOMS` | `id` | `{id}` | Yes | Yes | **Yes** | No | **3NF** | Conditional dependency $\{\text{type}, \text{cohortId}\} \to \text{name}$ has nullable determinant. Unified for query simplicity. |
| `MESSAGES` | `id` | `{id}` | Yes | Yes | Yes | **Yes** | **BCNF** | Single candidate key determines all non-key attributes. |
| `MESSAGE_REACTIONS` | `id` | `{id}`, `{messageId, userId, reaction}` | Yes | Yes | Yes | **Yes** | **BCNF** | Composite candidate key uniquely determines reaction timestamps. |
| `REPORTS` | `id` | `{id}`, `{messageId, reporterId}` | Yes | Yes | Yes | **Yes** | **BCNF** | Composite unique constraint prevents duplicate reporting. |
| `BANS` | `id` | `{id}` | Yes | Yes | Yes | **Yes** | **BCNF** | Single candidate key determines penalty attributes. |
| `ANNOUNCEMENTS` | `id` | `{id}` | Yes | Yes | Yes | **Yes** | **BCNF** | Single candidate key determines notice attributes. |
| `ANNOUNCEMENT_ATTACHMENTS` | `id` | `{id}`, `{announcementId, storagePath}` | Yes | Yes | Yes | **Yes** | **BCNF** | All determinants are superkeys. |
| `AUDIT_LOGS` | `id` | `{id}` | Yes | Yes | Yes | **Yes** | **BCNF** | Immutable append-only schema. |
| `NOTIFICATION_DEVICES` | `id` | `{id}`, `{pushToken}` | Yes | Yes | Yes | **Yes** | **BCNF** | Both determinants are candidate keys. |

---

## 3. Lossless Join & Dependency Preservation Analysis

### 3.1 Lossless Join Property
A decomposition of relation $R$ into $D = \{R_1, R_2\}$ is a **Lossless-Join Decomposition** with respect to functional dependencies $F$ if and only if:
$$(R_1 \cap R_2) \to R_1 \quad \text{OR} \quad (R_1 \cap R_2) \to R_2 \in F^+$$

In CampusConnect, when relations are decomposed (e.g. separating `USERS` and `ANONYMOUS_IDENTITIES` to protect privacy):
- $R_1 = \text{USERS}(\underline{\text{id}}, \text{collegeId}, \text{collegeEmail}, \dots)$
- $R_2 = \text{ANONYMOUS\_IDENTITIES}(\underline{\text{id}}, \text{userId}, \text{displayName}, \dots)$
- Intersection: $R_1 \cap R_2 = \{\text{userId}\}$ (where $\text{userId}$ references $R_1.\text{id}$).
- Since $\text{id} \to R_1$, the condition $(R_1 \cap R_2) \to R_1$ is satisfied.
- **Proof:** The decomposition is strictly **lossless**.

### 3.2 Dependency Preservation Property
A decomposition $D = \{R_1, R_2, \dots, R_m\}$ is **dependency-preserving** if:
$$\left( \bigcup_{i=1}^m \pi_{R_i}(F) \right)^+ = F^+$$
All genuine functional dependencies in CampusConnect can be verified within individual relations using local constraints or foreign key indices without requiring full cross-relation joins.
