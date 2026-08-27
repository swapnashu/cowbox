from setuptools import setup, find_packages

setup(
    name="cowbox",
    version="0.1.0",
    description="Cowbox - Self-Hosted PaaS Management Hub",
    author="Cowbox Team",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[],
    entry_points={
        "console_scripts": [
            "cowbox=cowbox.cli:main",
        ],
    },
)
