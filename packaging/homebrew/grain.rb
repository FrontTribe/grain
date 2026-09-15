# typed: false
# frozen_string_literal: true

# Homebrew formula for grain. Updated by packaging/homebrew/update-formula.sh.
class Grain < Formula
  desc "Code provenance layer — see how much of your codebase is human-written vs AI"
  homepage "https://github.com/FrontTribe/grain"
  version "0.2.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/FrontTribe/grain/releases/download/v#{version}/grain-darwin-arm64"
      sha256 "278afd16e416bc6169bc183e150a7ed7c646daa7f025a925c448e8d45da475a3"
    end
    on_intel do
      url "https://github.com/FrontTribe/grain/releases/download/v#{version}/grain-darwin-amd64"
      sha256 "3a0a8272b6d1ae857c36df77d6939c867e26f00388463d528520cafeae841ea3"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/FrontTribe/grain/releases/download/v#{version}/grain-linux-arm64"
      sha256 "f3c1a1e183d10fb54f562ddeafd76064be337feea8caa71413e98737ad3822d8"
    end
    on_intel do
      url "https://github.com/FrontTribe/grain/releases/download/v#{version}/grain-linux-amd64"
      sha256 "8d03b379e1c547ee281f93d73149bf4419af50198b2db9e5232e9729ee690b54"
    end
  end

  def install
    bin.install Dir["grain-*"].first => "grain"
  end

  test do
    assert_match "grain #{version}", shell_output("#{bin}/grain version")
  end
end
