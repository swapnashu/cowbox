from setuptools import setup, find_packages

setup(
    name="cowbox",
    version="0.2.0",
    description="Cowbox - Self-Hosted PaaS Management Hub",
    long_description="Cowbox is an open-source, self-hosted Platform-as-a-Service (PaaS) and container control plane alternative to Dokploy, Coolify, and Easypanel.",
    long_description_content_type="text/markdown",
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
