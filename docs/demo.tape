# Record the grain demo GIF.
#   Requires: VHS (https://github.com/charmbracelet/vhs) and `grain` on your PATH.
#   Run:      vhs docs/demo.tape   →   writes docs/demo.gif
#
# Then uncomment the image line in README.md to embed it.

Output docs/demo.gif

Set Shell "bash"
Set FontSize 20
Set Width 1200
Set Height 720
Set Padding 26
Set TypingSpeed 55ms
Set Theme { "background": "#17150F", "foreground": "#E7E1D4", "cursor": "#57C6A8", "green": "#57C6A8", "yellow": "#E28A50", "black": "#17150F", "white": "#E7E1D4" }

Sleep 500ms
Type "grain scan"
Sleep 400ms
Enter
Sleep 3s

Type "grain explain HEAD"
Sleep 400ms
Enter
Sleep 3s

Type "grain check --range HEAD~3..HEAD"
Sleep 400ms
Enter
Sleep 3500ms
