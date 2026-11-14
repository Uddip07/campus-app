# CampusConnect — Functional Dependencies & Candidate Key Analysis

## 1. Mathematical Formulation

Let $R(U)$ be a relation schema over a universal set of attributes $U$, and let $F$ be a set of functional dependencies (FDs) over $R$.
A functional dependency $X \to Y$ holds on $R$ if for every legal relation state $r(R)$, any two tuples $t_1, t_2 \in r$ that satisfy $t_1[X] = t_2[X]$ must also satisfy $t_1[Y] = t_2[Y]$.

An attribute set $K \subseteq U$ is a **Superkey** of $R$ if $K \to U$.
$K$ is a **Candidate Key** of $R$ if $K$ is a minimal superkey (no proper subset of $K$ is a superkey).
An attribute $A \in U$ is called a **Prime Attribute** if $A$ is a member of some candidate key of $R$. Otherwise, $A$ is a **Non-Prime Attribute**.

---

## 2. Rigorous Functional Dependencies by Relation

### 2.1 `COHORTS`
- **Attributes:** $U = \{\text{id}, \text{graduationYear}, \text{createdAt}, \text{updatedAt}\}$
- **Actual Functional Dependencies ($F$):**
  1. $FD_1: \text{id} \to \{\text{graduationYear}, \text{createdAt}, \text{updatedAt}\}$
  2. $FD_2: \text{graduationYear} \to \{\text{id}, \text{createdAt}, \text{updatedAt}\}$
- **Attribute Closures:**
  - $\{\text{id}\}^+ = U$
  - $\{\text{graduationYear}\}^+ = U$
- **Candidate Keys:** $CK_1 = \{\text{id}\}$, $CK_2 = \{\text{graduationYear}\}$
- **Prime Attributes:** $\{\text{id}, \text{graduationYear}\}$
- **Non-Prime Attributes:** $\{\text{createdAt}, \text{updatedAt}\}$

---

### 2.2 `USERS`
- **Attributes:** $U = \{\text{id}, \text{authId}, \text{collegeId}, \text{collegeEmail}, \text{enrollmentYear}, \text{programCode}, \text{rollNumber}, \text{cohortId}, \text{role}, \text{status}, \text{createdAt}, \text{updatedAt}\}$
- **Actual Functional Dependencies ($F$):**
  1. $FD_1: \text{id} \to U \setminus \{\text{id}\}$
  2. $FD_2: \text{collegeId} \to U \setminus \{\text{collegeId}\}$
  3. $FD_3: \text{collegeEmail} \to U \setminus \{\text{collegeEmail}\}$
  4. $FD_4: \text{collegeId} \to \{\text{enrollmentYear}, \text{programCode}, \text{rollNumber}\}$ *(Natural decomposition of NSUT student ID: e.g. `2024UIT1010` determines year 2024, program UIT, roll 1010)*
  5. $FD_5: \{\text{enrollmentYear}, \text{programCode}, \text{rollNumber}\} \to \text{collegeId}$
- **Attribute Closures:**
  - $\{\text{id}\}^+ = U$
  - $\{\text{collegeId}\}^+ = U$
  - $\{\text{collegeEmail}\}^+ = U$
  - $\{\text{enrollmentYear}, \text{programCode}, \text{rollNumber}\}^+ = U$ *(via $FD_5 \to \text{collegeId} \to U$)*
- **Candidate Keys:**
  - $CK_1 = \{\text{id}\}$
  - $CK_2 = \{\text{collegeId}\}$
  - $CK_3 = \{\text{collegeEmail}\}$
  - $CK_4 = \{\text{enrollmentYear}, \text{programCode}, \text{rollNumber}\}$
- **Prime Attributes:** $\{\text{id}, \text{collegeId}, \text{collegeEmail}, \text{enrollmentYear}, \text{programCode}, \text{rollNumber}\}$
- **Non-Prime Attributes:** $\{\text{authId}, \text{cohortId}, \text{role}, \text{status}, \text{createdAt}, \text{updatedAt}\}$

---

### 2.3 `ANONYMOUS_IDENTITIES`
- **Attributes:** $U = \{\text{id}, \text{userId}, \text{displayName}, \text{avatarSeed}, \text{validFrom}, \text{validUntil}, \text{isActive}, \text{createdAt}, \text{updatedAt}\}$
- **Actual Functional Dependencies ($F$):**
  1. $FD_1: \text{id} \to U \setminus \{\text{id}\}$
  2. $FD_2: \text{displayName} \to U \setminus \{\text{displayName}\}$
- **Attribute Closures:**
  - $\{\text{id}\}^+ = U$
  - $\{\text{displayName}\}^+ = U$
- **Candidate Keys:** $CK_1 = \{\text{id}\}$, $CK_2 = \{\text{displayName}\}$
- **Prime Attributes:** $\{\text{id}, \text{displayName}\}$
- **Non-Prime Attributes:** $\{\text{userId}, \text{avatarSeed}, \text{validFrom}, \text{validUntil}, \text{isActive}, \text{createdAt}, \text{updatedAt}\}$

---

### 2.4 `ROOMS`
- **Attributes:** $U = \{\text{id}, \text{type}, \text{name}, \text{cohortId}, \text{createdAt}, \text{updatedAt}\}$
- **Actual Functional Dependencies ($F$):**
  1. $FD_1: \text{id} \to U \setminus \{\text{id}\}$
  2. $FD_2: \{\text{type}, \text{cohortId}\} \to \{\text{id}, \text{name}, \text{createdAt}, \text{updatedAt}\}$ *(for cohort-scoped rooms where $\text{type} = \text{'cohort'}$)*
- **Candidate Keys:** $CK_1 = \{\text{id}\}$
- **Prime Attributes:** $\{\text{id}\}$
- **Non-Prime Attributes:** $\{\text{type}, \text{name}, \text{cohortId}, \text{createdAt}, \text{updatedAt}\}$

---

### 2.5 `MESSAGES`
- **Attributes:** $U = \{\text{id}, \text{roomId}, \text{senderId}, \text{content}, \text{replyToId}, \text{moderationStatus}, \text{deletedAt}, \text{editedAt}, \text{createdAt}, \text{updatedAt}\}$
- **Actual Functional Dependencies ($F$):**
  1. $FD_1: \text{id} \to U \setminus \{\text{id}\}$
- **Candidate Keys:** $CK_1 = \{\text{id}\}$
- **Prime Attributes:** $\{\text{id}\}$
- **Non-Prime Attributes:** $\{\text{roomId}, \text{senderId}, \text{content}, \text{replyToId}, \text{moderationStatus}, \text{deletedAt}, \text{editedAt}, \text{createdAt}, \text{updatedAt}\}$

---

### 2.6 `MESSAGE_REACTIONS`
- **Attributes:** $U = \{\text{id}, \text{messageId}, \text{userId}, \text{reaction}, \text{createdAt}\}$
- **Actual Functional Dependencies ($F$):**
  1. $FD_1: \text{id} \to \{\text{messageId}, \text{userId}, \text{reaction}, \text{createdAt}\}$
  2. $FD_2: \{\text{messageId}, \text{userId}, \text{reaction}\} \to \{\text{id}, \text{createdAt}\}$
- **Attribute Closures:**
  - $\{\text{id}\}^+ = U$
  - $\{\text{messageId}, \text{userId}, \text{reaction}\}^+ = U$
- **Candidate Keys:** $CK_1 = \{\text{id}\}$, $CK_2 = \{\text{messageId}, \text{userId}, \text{reaction}\}$
- **Prime Attributes:** $\{\text{id}, \text{messageId}, \text{userId}, \text{reaction}\}$
- **Non-Prime Attributes:** $\{\text{createdAt}\}$

---

### 2.7 `REPORTS`
- **Attributes:** $U = \{\text{id}, \text{messageId}, \text{reporterId}, \text{reason}, \text{description}, \text{status}, \text{reviewedBy}, \text{resolvedAt}, \text{createdAt}, \text{updatedAt}\}$
- **Actual Functional Dependencies ($F$):**
  1. $FD_1: \text{id} \to U \setminus \{\text{id}\}$
  2. $FD_2: \{\text{messageId}, \text{reporterId}\} \to \{\text{id}, \text{reason}, \text{description}, \text{status}, \text{reviewedBy}, \text{resolvedAt}, \text{createdAt}, \text{updatedAt}\}$
- **Candidate Keys:** $CK_1 = \{\text{id}\}$, $CK_2 = \{\text{messageId}, \text{reporterId}\}$
- **Prime Attributes:** $\{\text{id}, \text{messageId}, \text{reporterId}\}$
- **Non-Prime Attributes:** $\{\text{reason}, \text{description}, \text{status}, \text{reviewedBy}, \text{resolvedAt}, \text{createdAt}, \text{updatedAt}\}$

---

### 2.8 `BANS`
- **Attributes:** $U = \{\text{id}, \text{userId}, \text{type}, \text{reason}, \text{expiresAt}, \text{createdBy}, \text{createdAt}\}$
- **Actual Functional Dependencies ($F$):**
  1. $FD_1: \text{id} \to U \setminus \{\text{id}\}$
- **Candidate Keys:** $CK_1 = \{\text{id}\}$
- **Prime Attributes:** $\{\text{id}\}$
- **Non-Prime Attributes:** $\{\text{userId}, \text{type}, \text{reason}, \text{expiresAt}, \text{createdBy}, \text{createdAt}\}$

---

### 2.9 `ANNOUNCEMENTS`
- **Attributes:** $U = \{\text{id}, \text{title}, \text{content}, \text{authorId}, \text{audienceType}, \text{cohortId}, \text{isPinned}, \text{publishedAt}, \text{expiresAt}, \text{createdAt}, \text{updatedAt}\}$
- **Actual Functional Dependencies ($F$):**
  1. $FD_1: \text{id} \to U \setminus \{\text{id}\}$
- **Candidate Keys:** $CK_1 = \{\text{id}\}$
- **Prime Attributes:** $\{\text{id}\}$
- **Non-Prime Attributes:** All remaining attributes.

---

### 2.10 `ANNOUNCEMENT_ATTACHMENTS`
- **Attributes:** $U = \{\text{id}, \text{announcementId}, \text{storagePath}, \text{fileName}, \text{mimeType}, \text{fileSize}, \text{createdAt}\}$
- **Actual Functional Dependencies ($F$):**
  1. $FD_1: \text{id} \to U \setminus \{\text{id}\}$
  2. $FD_2: \{\text{announcementId}, \text{storagePath}\} \to U \setminus \{\text{announcementId}, \text{storagePath}\}$
- **Candidate Keys:** $CK_1 = \{\text{id}\}$, $CK_2 = \{\text{announcementId}, \text{storagePath}\}$
- **Prime Attributes:** $\{\text{id}, \text{announcementId}, \text{storagePath}\}$
- **Non-Prime Attributes:** $\{\text{fileName}, \text{mimeType}, \text{fileSize}, \text{createdAt}\}$

---

### 2.11 `AUDIT_LOGS`
- **Attributes:** $U = \{\text{id}, \text{actorId}, \text{action}, \text{targetType}, \text{targetId}, \text{metadata}, \text{createdAt}\}$
- **Actual Functional Dependencies ($F$):**
  1. $FD_1: \text{id} \to U \setminus \{\text{id}\}$
- **Candidate Keys:** $CK_1 = \{\text{id}\}$
- **Prime Attributes:** $\{\text{id}\}$
- **Non-Prime Attributes:** All remaining attributes.

---

### 2.12 `NOTIFICATION_DEVICES`
- **Attributes:** $U = \{\text{id}, \text{userId}, \text{pushToken}, \text{platform}, \text{createdAt}, \text{lastSeenAt}\}$
- **Actual Functional Dependencies ($F$):**
  1. $FD_1: \text{id} \to U \setminus \{\text{id}\}$
  2. $FD_2: \text{pushToken} \to U \setminus \{\text{pushToken}\}$
- **Candidate Keys:** $CK_1 = \{\text{id}\}$, $CK_2 = \{\text{pushToken}\}$
- **Prime Attributes:** $\{\text{id}, \text{pushToken}\}$
- **Non-Prime Attributes:** $\{\text{userId}, \text{platform}, \text{createdAt}, \text{lastSeenAt}\}$
