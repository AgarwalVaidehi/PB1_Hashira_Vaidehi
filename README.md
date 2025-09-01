
## 📌 Problem Statement

We need to solve a quadratic polynomial equation:

$$
f(x) = ax^2 + bx + c = 0
$$

and find the value of the constant term **c**.

The inputs are provided in **two JSON files**:

1. **Roots JSON** – contains the roots of the polynomial (if available).
2. **Points JSON** – contains values of the function `f(x) = y` for given `x` values.

The twist:

* The numbers in JSON are stored in **arbitrary bases (2–36)**, not just decimal.
* Each number is represented as:

  ```json
  { "base": "b", "value": "s" }
  ```

  where `"b"` is the base and `"s"` is the string value in that base.

The task is to:

1. **Decode** the inputs into integers.
2. **Formulate equations** based on the given data.
3. **Solve for c** using an appropriate mathematical method.
4. **Print the value of c** (either as an integer or reduced fraction).

---

## 🔎 What the Code Does

The program `solve_c.js` handles two scenarios:

### **Mode A – Roots + One Point**

* Input: two roots (`r1`, `r2`) and one point `(x0, y0)`.
* Method: **Factor form of quadratic**

  $$
  f(x) = a(x-r_1)(x-r_2)
  $$

  * Use point `(x0,y0)` to solve for `a`.
  * Then compute:

    $$
    c = a \cdot r_1 r_2
    $$

### **Mode B – Three Points**

* Input: three points `(x1,y1)`, `(x2,y2)`, `(x3,y3)`.
* Method: **Cramer’s Rule** on a 3×3 linear system:

  $$
  \begin{bmatrix}
  x_1^2 & x_1 & 1 \\
  x_2^2 & x_2 & 1 \\
  x_3^2 & x_3 & 1
  \end{bmatrix}
  \begin{bmatrix}
  a \\ b \\ c
  \end{bmatrix}
  =
  \begin{bmatrix}
  y_1 \\ y_2 \\ y_3
  \end{bmatrix}
  $$
* Solve for `c` as:

  $$
  c = \frac{\det(A_c)}{\det(A)}
  $$

### **Common Features**

* Uses **BigInt** for exact integer arithmetic (no overflow).
* Handles **arbitrary base numbers** (2–36).
* Ensures results are simplified (prints integer or fraction).

---

```

---

## ⚡ How to Run

### Case 1: Roots + Point

```bash
node solve_c.js --roots roots.json --points points.json
```

### Case 2: Three Points

```bash
node solve_c.js --points points.json
```

### Optional: Use first `k` points (from JSON metadata)

```bash
node solve_c.js --points points.json --use-k
```

---

## 📖 Example Input & Output

### Input (`points.json`)

```json
{
  "keys": { "n": 3, "k": 3 },
  "1": { "base": "10", "value": "4" },
  "2": { "base": "2", "value": "111" },
  "3": { "base": "10", "value": "12" }
}
```

### Decoded

* (1, 4), (2, 7), (3, 12)

### Output

```
Used points (keys): 1, 2, 3
c = 3
```

---

## ⚠️ Edge Cases

* **Invalid inputs:** bases outside 2–36, or non-digit characters.
* **Duplicate points:** determinant becomes 0 (no unique quadratic).
* **Roots case:** denominator zero if the chosen point is also a root.


