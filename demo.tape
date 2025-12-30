# VHS Demo Script for github-things-sync
# Run with: vhs demo.tape

# Output settings
Output assets/demo.gif
Set FontSize 16
Set Width 1000
Set Height 700
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 30ms

# Start with a clear terminal
Hide
Type "clear"
Enter
Sleep 300ms
Show

# Show the init command
Type "github-things-sync init"
Sleep 300ms
Enter
Sleep 1s

# Since there's existing config, it asks to reconfigure
# Answer: Yes (type y)
Type "y"
Enter
Sleep 500ms

# Step 1: GitHub Token (password field - type fake token)
Type "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
Enter
Sleep 500ms

# Step 2: Things Auth Token (password field)
Type "xxxxxxxxxxxxxxxxxxxxxx"
Enter
Sleep 500ms

# Step 3: Project name - accept default "GitHub"
Enter
Sleep 500ms

# Step 4: Poll interval - accept default 300
Enter
Sleep 500ms

# Step 5: Sync types - checkboxes, accept all defaults (space to toggle, enter to confirm)
Enter
Sleep 500ms

# Step 6: Auto-start - accept default Yes
Enter
Sleep 1s

# Hold on the success message
Sleep 2s

# Clear and show status
Type "clear"
Enter
Sleep 300ms

Type "github-things-sync status"
Sleep 300ms
Enter
Sleep 3s

# Hold on final output
Sleep 3s
