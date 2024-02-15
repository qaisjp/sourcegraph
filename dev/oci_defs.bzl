load("@rules_oci//oci:defs.bzl", base_oci_image = "oci_image", base_oci_tarball = "oci_tarball")
load("@with_cfg.bzl", "with_cfg")

REGISTRY_REPOSITORY_PREFIX = "europe-west1-docker.pkg.dev/sourcegraph-security-logging/rules-oci-test/{}"
# REGISTRY_REPOSITORY_PREFIX = "us.gcr.io/sourcegraph-dev/{}"

def image_repository(image):
    return REGISTRY_REPOSITORY_PREFIX.format(image)

_oci_image_builder = with_cfg(base_oci_image)
_oci_image_builder.set("platforms", select({
    "@platforms//os:macos": [Label("@zig_sdk//platform:linux_amd64")],
    "//conditions:default": [],
}))

oci_image, _oci_image_internal = _oci_image_builder.build()

_oci_tarball_builder = with_cfg(base_oci_tarball)
_oci_tarball_builder.set("platforms", select({
    "@platforms//os:macos": [Label("@zig_sdk//platform:linux_amd64")],
    "//conditions:default": [],
}))

oci_tarball, _oci_tarball_internal = _oci_tarball_builder.build()
