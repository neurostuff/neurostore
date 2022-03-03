#!/usr/bin/env python
from setuptools import setup, find_packages


requirements = [
    "flask",
    "flask_security",
    "email_validator",
    "flask-dance",
    "sqlalchemy-utils",
    "flask-cors",
    "flask-sqlalchemy",
    "pyld",
    "flask-graphql",
    "marshmallow>=3.0.0",
    "webargs",
    "shortuuid",
    "pandas",
    "scipy",
]

print("PACKAGES:", find_packages(exclude=["tests", "test_*"]))

setup(
    name="neurosynth",
    version="0.0.0",
    description="neurosynth",
    install_requires=requirements,
    maintainer="Tal Yarkoni",
    maintainer_email="tyarkoni@gmail.com",
    packages=find_packages(exclude=["tests", "test_*"]),
    license="MIT",
)
