# typed: false
# frozen_string_literal: true

# Homebrew formula for grain. Updated by packaging/homebrew/update-formula.sh.
class Grain < Formula
  desc "Code provenance layer — see how much of your codebase is human-written vs AI"
  homepage "https://github.com/FrontTribe/grain"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/FrontTribe/grain/releases/download/v#{version}/grain-darwin-arm64"
      sha256 "7aee4d3559991cc1de8a20c918ce58f1f816431481de4a4504612b67dc30645a"
    end
    on_intel do
      url "https://github.com/FrontTribe/grain/releases/download/v#{version}/grain-darwin-amd64"
      sha256 "77f2e8987f2cd2058f7d3ea3457290b8becc605a6233f1cd9ad1c666dabc8c2a"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/FrontTribe/grain/releases/download/v#{version}/grain-linux-arm64"
      sha256 "9000b831ec9746599470dd0b0263a89d084672c3685b39f7c8ff073de0fe6d8b"
    end
    on_intel do
      url "https://github.com/FrontTribe/grain/releases/download/v#{version}/grain-linux-amd64"
      sha256 "ee70e4fd72010b65ac87745c49a890720f570155d5376bf5a0b21a4b12469b85"
    end
  end

  def install
    bin.install Dir["grain-*"].first => "grain"
  end

  test do
    assert_match "grain #{version}", shell_output("#{bin}/grain version")
  end
end
