package com.hackathonday.migrationhelper.policy;

import java.util.List;

public record ComponentPolicy(String ecosystem, String component, List<VersionPolicy> versions) {
}
