package com.hackathonday.migrationhelper.policy;

public record PolicyMatch(ComponentPolicy componentPolicy, VersionPolicy versionPolicy, PolicySource source) {
}
