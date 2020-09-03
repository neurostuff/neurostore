#!/usr/bin/env python
import os
from setuptools import setup, find_packages


requirements = [
    'flask',
    'flask_security',
    'email_validator',
    'flask-dance',
    'sqlalchemy-utils',
    'flask-cors',
    'flask-sqlalchemy',
    'pyld',
    'flask-graphql',
    'marshmallow>=3.0.0',
    'shortuuid',
    'pandas'
    ]

print("PACKAGES:", find_packages(exclude=['tests', 'test_*']))

setup(
    name="neurostuff",
    version='0.0.0',
    description="NeuroStuff",
    install_requires=requirements,
    maintainer='Tal Yarkoni',
    maintainer_email='tyarkoni@gmail.com',
    packages=find_packages(exclude=['tests', 'test_*']),
    license='MIT'
)
