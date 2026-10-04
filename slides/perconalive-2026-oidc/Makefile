THEME := theme
export TEXINPUTS := .:$(THEME)//:

DECKS := oidc_talk

all: $(DECKS:%=%_plam2026.pdf)

# mutool ignores CSS classes, inline the fills before converting
# dark variant for white slides, light variant for the dark title page
perconalive.pdf: LOGO_DARK = 282727
perconalive.pdf: LOGO_BRAND = 653df4
perconalive_light.pdf: LOGO_DARK = ffffff
perconalive_light.pdf: LOGO_BRAND = f6fe54
perconalive.pdf perconalive_light.pdf: perconalive.svg
	sed -e 's/class="pl-logo-v2__dark"/fill="#$(LOGO_DARK)"/g' -e 's/class="pl-logo-v2__brand"/fill="#$(LOGO_BRAND)"/g' -e 's/class="pl-logo-v2__none"/fill="none"/g' $< > $(@:.pdf=_inline.svg)
	mutool convert -o $@ $(@:.pdf=_inline.svg)
	rm -f $(@:.pdf=_inline.svg)

# strip the markdown fence, render with mermaid-cli (fetched via npx on first run)
mermaid.png: mermaid.md mermaid-config.json
	sed -n '/^```mermaid/,/^```/p' $< | sed '1d;$$d' > mermaid.mmd
	npx -y -p @mermaid-js/mermaid-cli mmdc -i mermaid.mmd -o $@ -b white -s 3 -c mermaid-config.json
	rm -f mermaid.mmd

$(DECKS:%=%_plam2026.pdf): plam2026_light.tex perconalive.pdf perconalive_light.pdf
oidc_talk_plam2026.pdf: mermaid.png

%_plam2026.pdf: %.tex
	pdflatex -shell-escape -interaction=nonstopmode -jobname=$*_plam2026 $<
	pdflatex -shell-escape -interaction=nonstopmode -jobname=$*_plam2026 $<

clean:
	rm -f $(foreach d,$(DECKS),$(d)_plam2026.aux $(d)_plam2026.log $(d)_plam2026.nav $(d)_plam2026.out $(d)_plam2026.snm $(d)_plam2026.toc $(d)_plam2026.vrb)
	rm -rf $(DECKS:%=_minted-%_plam2026)
	rm -f perconalive.pdf perconalive_light.pdf perconalive*_inline.svg mermaid.png mermaid.mmd

.PHONY: all clean
