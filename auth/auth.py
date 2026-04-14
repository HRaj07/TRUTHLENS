
import streamlit as st

users = []

def signup():
    st.title("Signup")
    name = st.text_input("Name")
    role = st.selectbox("Role", ["Applicant", "Interviewer"])

    if st.button("Register"):
        users.append({"name": name, "role": role})
        st.success("User created")

def login():
    st.title("Login")
    name = st.text_input("Enter Name")

    if st.button("Login"):
        for u in users:
            if u["name"] == name:
                st.session_state.user = u
                st.success("Logged in")
