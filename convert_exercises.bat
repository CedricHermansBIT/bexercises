@echo off
echo Converting Dodona exercises to web format...
python convert_exercises.py
if %errorlevel% equ 0 (
    echo.
    echo Conversion completed successfully!
    echo You can now open index.html in your browser to test the exercises.
    echo.
    echo To deploy to GitHub Pages:
    echo 1. Create a new GitHub repository
    echo 2. Upload all files to the repository
    echo 3. Enable GitHub Pages in repository settings
    echo.
) else (
    echo.
    echo Conversion failed. Make sure Python is installed and you have the required packages:
    echo pip install pyyaml
    echo.
)
pause

