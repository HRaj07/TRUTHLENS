
import random

questions = [
"Explain quicksort",
"What is dynamic programming?",
"Explain pointers in C++",
"What is OOP?"
]

def get_question():
    return random.choice(questions)
