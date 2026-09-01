# typed: false
# frozen_string_literal: true

# Homebrew formula for grain.
# The sha256 values below are placeholders — run packaging/homebrew/update-formula.sh
# after a release to fill them in, then copy this file into FrontTribe/homebrew-tap.
class Grain < Formula
  desc "Code provenance layer — see how much of your codebase is human-written vs AI"
  homepage "https://github.com/FrontTribe/grain"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/FrontTribe/grain/releases/download/v#{version}/grain-darwin-arm64"
      sha256 "REPLACE_DARWIN_ARM64"
    end
    on_intel do
      url "https://github.com/FrontTribe/grain/releases/download/v#{version}/grain-darwin-amd64"
      sha256 "REPLACE_DARWIN_AMD64"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/FrontTribe/grain/releases/download/v#{version}/grain-linux-arm64"
      sha256 "REPLACE_LINUX_ARM64"
    end
    on_intel do
      url "https://github.com/FrontTribe/grain/releases/download/v#{version}/grain-linux-amd64"
      sha256 "REPLACE_LINUX_AMD64"
    end
  end

  def install
    bin.install Dir["grain-*"].first => "grain"
  end

  test do
    assert_match "grain #{version}", shell_output("#{bin}/grain version")
  end
end
