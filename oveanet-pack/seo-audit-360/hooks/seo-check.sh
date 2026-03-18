#!/bin/bash
# SEO Pre-Commit Hook — Catches common SEO issues before commit.
# Install: cp hooks/seo-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
#
# Author: Laurent Rochetta | BMAD+ SEO Engine

ERRORS=0
WARNINGS=0

echo "🔎 BMAD+ SEO Pre-Commit Check..."

# Only check staged HTML files
HTML_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -iE '\.(html|htm|php|jsx|tsx)$')

if [ -z "$HTML_FILES" ]; then
    echo "  No HTML files staged, skipping SEO check."
    exit 0
fi

for FILE in $HTML_FILES; do
    # Skip node_modules and vendor
    if echo "$FILE" | grep -qE '(node_modules|vendor|dist|build|\.min\.)'; then
        continue
    fi

    CONTENT=$(git show ":$FILE" 2>/dev/null)
    if [ -z "$CONTENT" ]; then
        continue
    fi

    # Check 1: Missing <title> tag
    if ! echo "$CONTENT" | grep -qi '<title'; then
        echo "  🔴 $FILE — Missing <title> tag"
        ERRORS=$((ERRORS + 1))
    fi

    # Check 2: Empty <title> tag
    if echo "$CONTENT" | grep -qiE '<title>\s*</title>'; then
        echo "  🔴 $FILE — Empty <title> tag"
        ERRORS=$((ERRORS + 1))
    fi

    # Check 3: Missing meta description
    if ! echo "$CONTENT" | grep -qi 'name="description"'; then
        echo "  🟠 $FILE — Missing <meta name=\"description\">"
        WARNINGS=$((WARNINGS + 1))
    fi

    # Check 4: Images without alt attribute
    IMG_NO_ALT=$(echo "$CONTENT" | grep -ciE '<img[^>]*(?!alt)[^>]*>' 2>/dev/null || echo "0")
    # More reliable: count <img> without alt
    TOTAL_IMGS=$(echo "$CONTENT" | grep -ci '<img' 2>/dev/null || echo "0")
    IMGS_WITH_ALT=$(echo "$CONTENT" | grep -ci '<img[^>]*alt=' 2>/dev/null || echo "0")
    MISSING_ALT=$((TOTAL_IMGS - IMGS_WITH_ALT))

    if [ "$MISSING_ALT" -gt 0 ]; then
        echo "  🟠 $FILE — $MISSING_ALT image(s) without alt attribute"
        WARNINGS=$((WARNINGS + 1))
    fi

    # Check 5: Multiple H1 tags
    H1_COUNT=$(echo "$CONTENT" | grep -ci '<h1' 2>/dev/null || echo "0")
    if [ "$H1_COUNT" -gt 1 ]; then
        echo "  🟡 $FILE — Multiple H1 tags ($H1_COUNT found, should be 1)"
        WARNINGS=$((WARNINGS + 1))
    fi

    # Check 6: No H1 tag at all
    if [ "$H1_COUNT" -eq 0 ]; then
        echo "  🟠 $FILE — No H1 tag found"
        WARNINGS=$((WARNINGS + 1))
    fi

    # Check 7: "Click here" or "Learn more" anchor text
    BAD_ANCHORS=$(echo "$CONTENT" | grep -ciE '>click here<|>learn more<|>read more<|>here<' 2>/dev/null || echo "0")
    if [ "$BAD_ANCHORS" -gt 0 ]; then
        echo "  🟡 $FILE — $BAD_ANCHORS link(s) with generic anchor text (\"click here\", \"learn more\")"
        WARNINGS=$((WARNINGS + 1))
    fi
done

echo ""
echo "  Results: $ERRORS error(s), $WARNINGS warning(s)"

if [ "$ERRORS" -gt 0 ]; then
    echo "  ❌ Commit blocked — fix critical SEO issues first!"
    exit 1
else
    if [ "$WARNINGS" -gt 0 ]; then
        echo "  ⚠️ Commit allowed with warnings — consider fixing these issues."
    else
        echo "  ✅ All SEO checks passed!"
    fi
    exit 0
fi
