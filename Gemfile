source "https://rubygems.org"

# Jekyll version is pinned by the github-pages gem below, so no explicit
# `gem "jekyll"` line is needed. Run Jekyll with:
#
#     bundle exec jekyll serve
#

group :jekyll_plugins do
  gem "github-pages", "~> 232", group: :jekyll_plugins
  gem "jekyll-feed", "~> 0.17"
end

# Windows does not include zoneinfo files, so bundle the tzinfo-data gem
gem "tzinfo-data", platforms: [:mingw, :mswin, :x64_mingw, :jruby]

# Performance-booster for watching directories on Windows
gem "wdm", "~> 0.1.0" if Gem.win_platform?

