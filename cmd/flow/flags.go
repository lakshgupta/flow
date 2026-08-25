package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"strings"
)

type stringListFlag []string

func (flagValue *stringListFlag) String() string {
	return strings.Join(*flagValue, ",")
}

func (flagValue *stringListFlag) Set(value string) error {
	*flagValue = append(*flagValue, value)
	return nil
}

type stringMapFlag map[string]string

func (flagValue *stringMapFlag) String() string {
	parts := make([]string, 0, len(*flagValue))
	for key, value := range *flagValue {
		parts = append(parts, key+"="+value)
	}

	return strings.Join(parts, ",")
}

func (flagValue *stringMapFlag) Set(value string) error {
	if value == "" {
		return fmt.Errorf("env must use KEY=VALUE format")
	}

	parts := strings.SplitN(value, "=", 2)
	if len(parts) != 2 || parts[0] == "" {
		return fmt.Errorf("env must use KEY=VALUE format")
	}

	if *flagValue == nil {
		*flagValue = map[string]string{}
	}

	(*flagValue)[parts[0]] = parts[1]
	return nil
}

func parseGlobalFlag(args []string) (bool, []string) {
	if len(args) == 0 || args[0] != "-g" {
		return false, args
	}

	return true, args[1:]
}

func isHelpOption(value string) bool {
	return value == "-h" || value == "--help"
}

func writeHelpIfRequested(args []string, writer io.Writer, writeHelp func(io.Writer)) bool {
	if len(args) == 0 || !isHelpOption(args[0]) {
		return false
	}

	writeHelp(writer)
	return true
}

func parseFlagSetWithHelp(flagSet *flag.FlagSet, args []string, env commandEnv, writeHelp func(io.Writer)) (bool, error) {
	savedUsage := flagSet.Usage
	flagSet.Usage = func() {}
	defer func() { flagSet.Usage = savedUsage }()

	if err := flagSet.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			writeHelp(env.stdout)
			return true, nil
		}

		return false, err
	}

	return false, nil
}
