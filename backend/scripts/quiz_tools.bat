@echo off
REM Quiz Answer Validation Tools
REM 
REM This script provides convenient access to quiz validation tools

cd /d "%~dp0\.."

if "%1"=="check" (
    echo Checking database for quiz attempts with missing answers...
    python check_quiz_missing_answers.py
    goto :eof
)

if "%1"=="test" (
    echo Running quiz answer validation tests...
    python test_quiz_answer_validation.py
    goto :eof
)

echo Quiz Answer Validation Tools
echo.
echo Usage: %~nx0 {check^|test}
echo.
echo Commands:
echo   check    - Check database for quiz attempts with missing answers
echo   test     - Run quiz answer validation tests
echo.
echo Examples:
echo   %~nx0 check    # Check database
echo   %~nx0 test     # Run tests
